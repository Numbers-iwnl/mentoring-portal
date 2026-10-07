"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { writeAudit } from "./audit";
import { requireUser } from "./guards";
import { prisma } from "./prisma";

function clearSessionCookies() {
  const jar = cookies();
  for (const name of ["next-auth.session-token", "__Secure-next-auth.session-token"]) {
    if (jar.get(name)) {
      jar.set(name, "", { maxAge: 0, path: "/" });
    }
  }
}

export async function changeOwnPassword(formData: FormData) {
  const sessionUser = await requireUser();
  const basePath = sessionUser.role === "ADMIN" ? "/admin/conta" : "/app/conta";
  const forced = String(formData.get("force") || "") === "1";
  const errorSuffix = forced ? "&force=1" : "";

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (newPassword.length < 8) redirect(`${basePath}?error=curta${errorSuffix}`);
  if (newPassword !== confirmPassword) redirect(`${basePath}?error=confirmacao${errorSuffix}`);
  if (newPassword === currentPassword) redirect(`${basePath}?error=igual${errorSuffix}`);

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user || !user.active) redirect("/login");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) redirect(`${basePath}?error=senhaAtual${errorSuffix}`);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: false }
  });

  await writeAudit({
    userId: user.id,
    studentId: user.studentId ?? undefined,
    action: "account.password.change",
    entity: "User",
    entityId: user.id,
    metadata: forced ? { forced: true } : undefined
  });

  if (user.mustChangePassword) {
    // The session token still carries the old flag; end the session so the
    // user signs back in with the new password and a clean token.
    clearSessionCookies();
    redirect("/login?senhaAlterada=1");
  }

  redirect(`${basePath}?saved=1`);
}
