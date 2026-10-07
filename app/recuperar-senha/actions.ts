"use server";

import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { requestBaseUrl } from "@/lib/credential-mail";
import { isMailAvailable, sendMail } from "@/lib/mailer";
import { createResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

export async function requestPasswordReset(formData: FormData) {
  if (!isMailAvailable()) redirect("/recuperar-senha?error=indisponivel");

  const email = String(formData.get("email") || "").toLowerCase().trim();
  if (!email || !email.includes("@")) redirect("/recuperar-senha?error=email");

  const user = await prisma.user.findUnique({ where: { email } });

  let sendFailed = false;
  if (user?.active) {
    const token = await createResetToken(user.id);
    const link = `${requestBaseUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;
    const firstName = user.name.split(" ")[0] || user.name;

    try {
      await sendMail({
        to: user.email,
        subject: "Redefinição de senha — Aurora Mentoring",
        text: [
          `Olá, ${firstName}.`,
          "",
          "Recebemos um pedido para redefinir a senha do seu acesso ao portal Aurora Mentoring.",
          `Use o link abaixo (válido por ${RESET_TOKEN_TTL_MINUTES} minutos):`,
          "",
          link,
          "",
          "Se você não pediu a redefinição, ignore este e-mail — sua senha continua a mesma."
        ].join("\n"),
        html: `
          <div style="background:#000623;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
            <div style="max-width:520px;margin:0 auto;background:#0c1834;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:32px">
              <p style="margin:0;font-size:11px;letter-spacing:3px;color:#c7d8e4;text-transform:uppercase">Aurora Mentoring</p>
              <h1 style="margin:14px 0 0;font-size:22px;color:#ffffff">Redefinição de senha</h1>
              <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:rgba(245,247,248,0.75)">
                Olá, ${firstName}. Recebemos um pedido para redefinir a senha do seu acesso ao portal.
                O link abaixo é válido por ${RESET_TOKEN_TTL_MINUTES} minutos:
              </p>
              <p style="margin:24px 0">
                <a href="${link}" style="display:inline-block;background:#ffffff;color:#000623;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:8px;text-decoration:none">Definir nova senha</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(245,247,248,0.5)">
                Se você não pediu a redefinição, ignore este e-mail — sua senha continua a mesma.
              </p>
            </div>
          </div>
        `
      });

      await writeAudit({
        userId: user.id,
        studentId: user.studentId ?? undefined,
        action: "account.password.reset.request",
        entity: "User",
        entityId: user.id
      });
    } catch (error) {
      console.error("Failed to send password reset email", error);
      sendFailed = true;
    }
  }

  if (sendFailed) redirect("/recuperar-senha?error=envio");
  redirect("/recuperar-senha?sent=1");
}
