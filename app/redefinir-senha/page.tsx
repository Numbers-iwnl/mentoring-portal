import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { peekResetToken } from "@/lib/password-reset";
import { resetPasswordWithToken } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  curta: "A nova senha precisa ter pelo menos 8 caracteres.",
  confirmacao: "A confirmação não confere com a nova senha."
};

const darkInput =
  "border-[rgba(255,255,255,0.12)] bg-white/[0.055] pl-10 text-ivory placeholder:text-ivory/35 focus:border-champagne-300/70 focus:ring-[rgba(199,216,228,0.16)]";

export default async function RedefinirSenhaPage({
  searchParams
}: {
  searchParams?: { token?: string; error?: string };
}) {
  const token = searchParams?.token ?? "";
  const tokenValid = searchParams?.error === "invalido" ? false : token ? Boolean(await peekResetToken(token)) : false;
  const errorMessage = searchParams?.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <main className="login-texture flex min-h-screen items-center justify-center px-4 py-10 text-ivory">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#000623]/72 p-8 shadow-luxury backdrop-blur-sm sm:p-10">
        <Brand className="login-glow-logo" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-champagne-300">Recuperar acesso</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white">Definir nova senha</h1>

        {tokenValid ? (
          <>
            {errorMessage ? (
              <p className="mt-4 rounded-md border border-red-300/35 bg-red-950/45 px-3 py-2 text-sm text-red-100">{errorMessage}</p>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[rgba(245,247,248,0.62)]">Escolha uma nova senha com pelo menos 8 caracteres.</p>
            )}
            <form action={resetPasswordWithToken} className="mt-6 grid gap-4">
              <input type="hidden" name="token" value={token} />
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(245,247,248,0.72)]">
                Nova senha
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-champagne-300/85" size={16} />
                  <Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className={darkInput} />
                </div>
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(245,247,248,0.72)]">
                Confirmar nova senha
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-champagne-300/85" size={16} />
                  <Input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className={darkInput} />
                </div>
              </label>
              <Button type="submit" className="login-submit h-12 w-full text-[0.95rem]">
                Salvar nova senha
              </Button>
            </form>
          </>
        ) : (
          <div className="mt-6 rounded-md border border-red-300/35 bg-red-950/45 px-4 py-3 text-sm leading-6 text-red-100">
            Este link de redefinição é inválido ou expirou. Peça um novo em{" "}
            <Link href="/recuperar-senha" className="font-semibold underline underline-offset-2">
              recuperar senha
            </Link>
            .
          </div>
        )}

        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-champagne-300 transition hover:text-white"
        >
          <ArrowLeft size={15} />
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
