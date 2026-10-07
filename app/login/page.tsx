import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Brand } from "@/components/layout/brand";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "./login-form";

const NOTICE_MESSAGES: Record<string, string> = {
  reset: "Senha redefinida com sucesso. Entre com a nova senha.",
  senhaAlterada: "Senha alterada com sucesso. Entre novamente com a nova senha."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams?: { reset?: string; senhaAlterada?: string };
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "ADMIN") redirect("/admin");
  if (session?.user) redirect("/app");

  const notice = searchParams?.reset ? NOTICE_MESSAGES.reset : searchParams?.senhaAlterada ? NOTICE_MESSAGES.senhaAlterada : undefined;

  return (
    <main className="login-texture flex min-h-screen items-center justify-center text-ivory 2xl:px-12 2xl:py-12">
      <div className="relative flex min-h-screen w-full overflow-hidden 2xl:h-[min(56rem,calc(100vh-6rem))] 2xl:min-h-0 2xl:max-w-[1440px] 2xl:rounded-2xl 2xl:border 2xl:border-white/10 2xl:shadow-luxury">
        <section className="relative flex w-full flex-col bg-[#000623]/55 px-6 py-8 backdrop-blur-[2px] sm:px-12 lg:w-[46%] lg:min-w-[520px] xl:px-16">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            <header>
              <Brand className="login-glow-logo" />
            </header>

            <div className="flex flex-1 items-center py-12">
              <div className="w-full">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-champagne-300">Portal reservado</p>
                <h1 className="shine-text mt-4 font-display text-4xl font-semibold leading-[1.04] tracking-normal sm:text-[2.9rem]">
                  Performance com precisão.
                </h1>
                <p className="mt-4 text-sm leading-6 text-[rgba(245,247,248,0.62)]">
                  Acesse o ambiente exclusivo dos mentorados Aurora.
                </p>
                {notice ? (
                  <p className="mt-5 rounded-md border border-emerald-300/30 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
                    {notice}
                  </p>
                ) : null}
                <div className={notice ? "mt-6" : "mt-9"}>
                  <LoginForm />
                </div>
              </div>
            </div>

            <footer className="border-t border-white/10 pt-5">
              <p className="text-xs leading-5 text-ivory/45">
                Acesso restrito a mentorados e administradores convidados. Dados protegidos por perfis de acesso e registro de
                auditoria.
              </p>
            </footer>
          </div>
        </section>

        <section className="relative hidden flex-1 lg:block" aria-hidden="true">
          <img
            src="/brand/site-bg.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[78%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#000623] via-[#000623]/15 to-[#000623]/30" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#000623]/85 to-transparent" />
        </section>
      </div>
    </main>
  );
}
