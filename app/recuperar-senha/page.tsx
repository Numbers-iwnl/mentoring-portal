import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { isMailAvailable } from "@/lib/mailer";
import { requestPasswordReset } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  email: "Informe um e-mail válido.",
  envio: "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.",
  indisponivel: "A recuperação automática está temporariamente indisponível. Fale com a equipe Aurora."
};

export default function RecuperarSenhaPage({ searchParams }: { searchParams?: { sent?: string; error?: string } }) {
  const mailAvailable = isMailAvailable();
  const errorMessage = searchParams?.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <main className="login-texture flex min-h-screen items-center justify-center px-4 py-10 text-ivory">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#000623]/72 p-8 shadow-luxury backdrop-blur-sm sm:p-10">
        <Brand className="login-glow-logo" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-champagne-300">Recuperar acesso</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white">Esqueceu sua senha?</h1>

        {searchParams?.sent ? (
          <div className="mt-6 rounded-md border border-emerald-300/30 bg-emerald-950/40 px-4 py-3 text-sm leading-6 text-emerald-100">
            Se este e-mail estiver cadastrado, enviamos um link de redefinição. Confira a caixa de entrada e o spam — o link vale
            por 60 minutos.
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-[rgba(245,247,248,0.62)]">
              {mailAvailable
                ? "Informe o e-mail de login e enviaremos um link para você definir uma nova senha."
                : "A recuperação automática por e-mail ainda não está ativa. Fale com a equipe Aurora para redefinir sua senha."}
            </p>

            {errorMessage ? (
              <p className="mt-4 rounded-md border border-red-300/35 bg-red-950/45 px-3 py-2 text-sm text-red-100">{errorMessage}</p>
            ) : null}

            {mailAvailable ? (
              <form action={requestPasswordReset} className="mt-6 grid gap-4">
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(245,247,248,0.72)]">
                  E-mail de login
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-champagne-300/85" size={16} />
                    <Input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="voce@empresa.com"
                      className="border-[rgba(255,255,255,0.12)] bg-white/[0.055] pl-10 text-ivory placeholder:text-ivory/35 focus:border-champagne-300/70 focus:ring-[rgba(199,216,228,0.16)]"
                    />
                  </div>
                </label>
                <Button type="submit" className="login-submit h-12 w-full text-[0.95rem]">
                  Enviar link de redefinição
                </Button>
              </form>
            ) : null}
          </>
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
