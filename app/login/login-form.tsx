"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

const darkInput =
  "border-[rgba(255,255,255,0.12)] bg-white/[0.055] pl-10 text-ivory placeholder:text-ivory/35 focus:border-champagne-300/70 focus:ring-[rgba(199,216,228,0.16)]";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      redirect: false,
      email: form.get("email"),
      password: form.get("password")
    });

    setLoading(false);
    if (result?.error) {
      setError("E-mail ou senha inválidos.");
      return;
    }
    router.push(params.get("callbackUrl") || "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(245,247,248,0.72)]">
        E-mail
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-champagne-300/85" size={16} />
          <Input name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" className={darkInput} />
        </div>
      </label>
      <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(245,247,248,0.72)]">
        Senha
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-champagne-300/85" size={16} />
          <Input name="password" type="password" required autoComplete="current-password" placeholder="Sua senha" className={darkInput} />
        </div>
      </label>
      <div className="-mt-1 flex justify-end">
        <Link
          href="/recuperar-senha"
          className="text-xs font-semibold normal-case tracking-normal text-champagne-300/90 transition hover:text-white"
        >
          Esqueci minha senha
        </Link>
      </div>
      {error ? <p className="rounded-md border border-red-300/35 bg-red-950/45 px-3 py-2 text-sm normal-case tracking-normal text-red-100">{error}</p> : null}
      <Button type="submit" disabled={loading} className="login-submit mt-2 h-12 w-full text-[0.95rem]">
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
