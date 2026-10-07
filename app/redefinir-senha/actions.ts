"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { consumeResetToken, peekResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

export async function resetPasswordWithToken(formData: FormData) {
  const token = String(formData.get("token") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const backWithToken = `/redefinir-senha?token=${encodeURIComponent(token)}`;

  const validUserId = await peekResetToken(token);
  if (!validUserId) redirect("/redefinir-senha?error=invalido");

  if (newPassword.length < 8) redirect(`${backWithToken}&error=curta`);
  if (newPassword !== confirmPassword) redirect(`${backWithToken}&error=confirmacao`);

  const userId = await consumeResetToken(token);
  if (!userId) redirect("/redefinir-senha?error=invalido");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) redirect("/redefinir-senha?error=invalido");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: false }
  });

  await writeAudit({
    userId: user.id,
    studentId: user.studentId ?? undefined,
    action: "account.password.reset",
    entity: "User",
    entityId: user.id
  });

  redirect("/login?reset=1");
}
