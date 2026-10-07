import nodemailer from "nodemailer";

/**
 * SMTP transport configured via environment (hPanel → variáveis de ambiente):
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465
 *   SMTP_USER=no-reply@example.com
 *   SMTP_PASSWORD=<senha da caixa de e-mail>
 *   SMTP_FROM=Aurora Mentoring <no-reply@example.com>
 *
 * Without these variables the recovery flow stays disabled (the page tells the
 * user to contact the team). In development, messages are logged to the console.
 */
export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export function isMailAvailable() {
  return isMailConfigured() || process.env.NODE_ENV !== "production";
}

export async function sendMail({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mail:dev] to=${to} subject=${subject}\n${text}`);
      return;
    }
    throw new Error("SMTP não configurado");
  }

  const port = Number(process.env.SMTP_PORT ?? 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  });
}
