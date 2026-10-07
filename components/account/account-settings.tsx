import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { changeOwnPassword } from "@/lib/account-actions";
import { Notice } from "@/components/ui/notice";
import { Toast } from "@/components/ui/toast";

const ERROR_MESSAGES: Record<string, string> = {
  curta: "A nova senha precisa ter pelo menos 8 caracteres.",
  confirmacao: "A confirmação não confere com a nova senha.",
  senhaAtual: "Senha atual incorreta.",
  igual: "A nova senha precisa ser diferente da atual."
};

export function AccountSettings({
  name,
  email,
  saved,
  error,
  force
}: {
  name: string;
  email: string;
  saved?: string;
  error?: string;
  force?: boolean;
}) {
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Minha conta</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Acesso e segurança</h1>
      </header>

      {force ? (
        <Notice variant="info">
          Por segurança, defina uma nova senha antes de continuar usando o portal. Depois de salvar, entre novamente com a nova
          senha.
        </Notice>
      ) : null}
      {saved ? (
        <Toast variant="success">
          Senha alterada com sucesso.
        </Toast>
      ) : null}
      {errorMessage ? (
        <Toast variant="error">{errorMessage}</Toast>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck size={18} />
              Dados de acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-graphite-800">
            <div className="flex items-center justify-between border-b border-[rgba(0,6,35,0.08)] pb-3">
              <span className="text-graphite-700/70">Nome</span>
              <strong>{name}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-graphite-700/70">E-mail de login</span>
              <strong>{email}</strong>
            </div>
            <p className="mt-2 text-xs leading-5 text-graphite-700/60">
              Para alterar o e-mail de login, fale com a equipe Aurora.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound size={18} />
              Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={changeOwnPassword} className="grid gap-4">
              {force ? <input type="hidden" name="force" value="1" /> : null}
              <Field label="Senha atual">
                <Input name="currentPassword" type="password" required autoComplete="current-password" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
                  <Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
                </Field>
                <Field label="Confirmar nova senha">
                  <Input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit">
                  <KeyRound size={16} />
                  Salvar nova senha
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
