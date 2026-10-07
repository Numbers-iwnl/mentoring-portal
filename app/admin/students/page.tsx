import Link from "next/link";
import { KeyRound, Settings2, UserPlus } from "lucide-react";
import { StudentUnitType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { studentUnitLabel } from "@/lib/student-units";
import { createStudentAccount } from "./actions";
import { Toast } from "@/components/ui/toast";

export default async function StudentsPage({
  searchParams
}: {
  searchParams?: { deleted?: string; created?: string; mail?: string };
}) {
  await requireAdmin();
  const students = await prisma.student.findMany({
    include: { users: true, units: true, _count: { select: { financeEntries: true, messageEntries: true } } },
    orderBy: { name: "asc" }
  });

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Mentorados</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Acessos e contas</h1>
      </header>
      {searchParams?.deleted ? (
        <Toast variant="success">
          Mentorado excluído com sucesso.
        </Toast>
      ) : null}
      {searchParams?.created ? (
        <Toast variant="success">
          Mentorado criado com sucesso.
          {searchParams?.mail === "ok"
            ? " As credenciais de acesso foram enviadas por e-mail."
            : " Não foi possível enviar o e-mail com as credenciais — informe o login e a senha manualmente."}
        </Toast>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus size={18} />
            Criar mentorado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createStudentAccount} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Nome">
                <Input name="name" required />
              </Field>
              <Field label="Clínica / empresa">
                <Input name="clinicName" />
              </Field>
              <Field label="Telefone">
                <Input name="phone" />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="E-mail de login">
                <Input name="loginEmail" type="email" required />
              </Field>
              <Field label="Senha inicial" hint="No primeiro acesso o mentorado é obrigado a trocar esta senha.">
                <Input name="password" type="password" required minLength={8} />
              </Field>
            </div>
            <fieldset className="grid gap-3 rounded-md border border-graphite-950/10 bg-graphite-950/[0.025] p-4">
              <legend className="px-1 text-sm font-semibold text-graphite-800">Áreas de preenchimento</legend>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-start gap-3 rounded-md border border-graphite-950/10 bg-white p-3 text-sm text-graphite-800">
                  <Input className="mt-0.5 h-4 w-4" name="unitTypes" type="checkbox" value={StudentUnitType.CLINIC} defaultChecked />
                  <span>
                    <strong className="block text-ink">Clínica</strong>
                    <span className="text-graphite-700/70">Vendas e mensagens da clínica ou consultório.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-graphite-950/10 bg-white p-3 text-sm text-graphite-800">
                  <Input className="mt-0.5 h-4 w-4" name="unitTypes" type="checkbox" value={StudentUnitType.MENTORSHIP} />
                  <span>
                    <strong className="block text-ink">Mentoria</strong>
                    <span className="text-graphite-700/70">Dados da mentoria, curso ou operação própria do mentorado.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-graphite-950/10 bg-white p-3 text-sm text-graphite-800">
                  <Input className="mt-0.5 h-4 w-4" name="unitTypes" type="checkbox" value={StudentUnitType.OTHER} />
                  <span>
                    <strong className="block text-ink">Outros</strong>
                    <span className="text-graphite-700/70">Outra empresa, projeto ou frente de acompanhamento.</span>
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="flex justify-end">
              <Button type="submit">
                <KeyRound size={16} />
                Criar acesso
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lista de mentorados</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table min-w-[880px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Nome</th>
                <th>Login</th>
                <th>Áreas</th>
                <th>Vendas</th>
                <th>Mensagens</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="py-3 font-semibold">
                    <Link href={`/admin/student/${student.id}`} className="transition hover:text-champagne-700">
                      {student.name}
                    </Link>
                  </td>
                  <td>{student.users.map((user) => user.email).join(", ") || "-"}</td>
                  <td>{student.units.filter((unit) => unit.active).map((unit) => studentUnitLabel(unit)).join(", ") || "-"}</td>
                  <td>{student._count.financeEntries}</td>
                  <td>{student._count.messageEntries}</td>
                  <td>{student.active ? "Ativo" : "Inativo"}</td>
                  <td>
                    <Link
                      href={`/admin/student/${student.id}`}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[rgba(0,6,35,0.12)] bg-[rgba(255,255,255,0.82)] px-3 text-xs font-semibold text-graphite-800 shadow-sm transition hover:border-champagne-500 hover:bg-white"
                    >
                      <Settings2 size={14} />
                      Gerenciar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
