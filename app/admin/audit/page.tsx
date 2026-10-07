import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { TIME_ZONE } from "@/lib/constants";

const ACTION_LABELS: Record<string, string> = {
  "finance.create": "Venda criada",
  "finance.update": "Venda editada",
  "finance.delete": "Venda excluída",
  "message.create": "Mensagem criada",
  "message.update": "Mensagem editada",
  "message.delete": "Mensagem excluída",
  "clinicCosts.update": "Custo/hora salvo",
  "professionals.add": "Profissional adicionado",
  "professionals.remove": "Profissional removido",
  "specialties.add": "Especialidade adicionada",
  "specialties.remove": "Especialidade removida",
  "import.spreadsheet": "Planilha importada",
  "student.create": "Mentorado criado",
  "student.update": "Mentorado editado",
  "student.units.update": "Áreas atualizadas",
  "student.units.rename": "Áreas renomeadas",
  "student.login.create": "Login criado",
  "student.login.update": "Login atualizado",
  "staff.login.create": "Funcionário criado",
  "staff.login.update": "Funcionário atualizado",
  "staff.login.delete": "Funcionário excluído",
  "student.delete": "Mentorado excluído",
  "student.goals.update": "Metas atualizadas",
  "account.password.change": "Senha alterada",
  "account.password.reset.request": "Redefinição de senha solicitada",
  "account.password.reset": "Senha redefinida por e-mail",
  "portalOptions.add": "Opção adicionada (Ajustes)",
  "portalOptions.remove": "Opção removida (Ajustes)",
  "portalOptions.restore": "Opções restauradas (Ajustes)"
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default async function AuditPage({ searchParams }: { searchParams?: { studentId?: string } }) {
  await requireAdmin();
  const students = await prisma.student.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const selectedStudentId = students.some((student) => student.id === searchParams?.studentId) ? searchParams?.studentId : undefined;

  const logs = await prisma.auditLog.findMany({
    where: selectedStudentId ? { studentId: selectedStudentId } : {},
    include: { user: { select: { name: true } }, student: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 150
  });

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Auditoria</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Registro de atividades</h1>
        <p className="mt-2 max-w-2xl text-sm text-graphite-700/75">
          Cada ação relevante no portal fica registrada aqui: quem fez, o quê e quando.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ScrollText size={18} />
            Últimas {logs.length} atividades
          </CardTitle>
          <form className="flex items-end gap-2" action="/admin/audit">
            <Field label="Mentorado">
              <Select name="studentId" defaultValue={selectedStudentId ?? ""} className="h-9 min-w-[220px]">
                <option value="">Todos</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary" className="h-9 px-3 text-xs">
              Filtrar
            </Button>
          </form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table min-w-[820px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Quando</th>
                <th>Quem</th>
                <th>Mentorado</th>
                <th>Ação</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap py-3">{formatDateTime(log.createdAt)}</td>
                  <td>{log.user?.name ?? "-"}</td>
                  <td>{log.student?.name ?? "-"}</td>
                  <td className="font-medium">{actionLabel(log.action)}</td>
                  <td>
                    {log.metadata ? (
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-champagne-700">ver</summary>
                        <pre className="mt-1 max-w-[360px] overflow-x-auto rounded-sm bg-graphite-950/[0.04] p-2 text-xs text-graphite-700">
                          {JSON.stringify(log.metadata, null, 1)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-graphite-700/50">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td className="py-4 text-graphite-700/65" colSpan={5}>
                    Nenhuma atividade registrada ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
