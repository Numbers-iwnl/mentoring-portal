import { headers } from "next/headers";
import { isMailAvailable, sendMail } from "./mailer";

export function requestBaseUrl() {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "portal.example.com";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Emails freshly created (or admin-reset) credentials to the account owner.
 * Only called at the moments the plaintext password is known; the portal
 * stores passwords only as hashes. Returns whether the email was sent so
 * callers can surface a warning without failing the operation.
 */
export async function sendCredentialsEmail({
  to,
  name,
  password,
  kind
}: {
  to: string;
  name: string;
  password: string;
  kind: "novo" | "redefinido";
}) {
  if (!isMailAvailable()) return false;

  const firstName = name.split(" ")[0] || name;
  const loginUrl = `${requestBaseUrl()}/login`;
  const intro =
    kind === "novo"
      ? "Seu acesso ao portal Aurora Mentoring foi criado."
      : "Sua senha do portal Aurora Mentoring foi redefinida pela equipe.";

  try {
    await sendMail({
      to,
      subject:
        kind === "novo"
          ? "Seu acesso ao portal Aurora Mentoring"
          : "Sua senha do portal foi redefinida — Aurora Mentoring",
      text: [
        `Olá, ${firstName}.`,
        "",
        intro,
        "",
        `Endereço: ${loginUrl}`,
        `E-mail de login: ${to}`,
        `Senha temporária: ${password}`,
        "",
        "No primeiro acesso o portal vai pedir para você criar uma senha própria.",
        "Depois disso, você pode trocá-la quando quiser no menu \"Minha conta\"."
      ].join("\n"),
      html: `
        <div style="background:#000623;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
          <div style="max-width:520px;margin:0 auto;background:#0c1834;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:32px">
            <p style="margin:0;font-size:11px;letter-spacing:3px;color:#c7d8e4;text-transform:uppercase">Aurora Mentoring</p>
            <h1 style="margin:14px 0 0;font-size:22px;color:#ffffff">${kind === "novo" ? "Seu acesso foi criado" : "Sua senha foi redefinida"}</h1>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:rgba(245,247,248,0.75)">Olá, ${firstName}. ${intro}</p>
            <div style="margin:20px 0;padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px">
              <p style="margin:0;font-size:13px;color:rgba(245,247,248,0.6)">E-mail de login</p>
              <p style="margin:4px 0 12px;font-size:15px;color:#ffffff;font-weight:bold">${to}</p>
              <p style="margin:0;font-size:13px;color:rgba(245,247,248,0.6)">Senha temporária</p>
              <p style="margin:4px 0 0;font-size:15px;color:#ffffff;font-weight:bold">${password}</p>
            </div>
            <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:rgba(245,247,248,0.6)">
              No primeiro acesso o portal pede para você criar uma senha própria. Depois disso, dá para trocar quando quiser em
              <strong>Minha conta</strong>.
            </p>
            <a href="${loginUrl}" style="display:inline-block;background:#ffffff;color:#000623;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:8px;text-decoration:none">Acessar o portal</a>
          </div>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error("Failed to send credentials email", error);
    return false;
  }
}
