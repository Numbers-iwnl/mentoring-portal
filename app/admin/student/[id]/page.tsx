import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Award, KeyRound, Save, Target, Trash2, UserPlus, Users } from "lucide-react";
import { StudentUnitType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Field, Input, Select } from "@/components/ui/field";
import { MetricCard } from "@/components/ui/metric-card";
import { getDashboardData } from "@/lib/dashboard";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { getUnitGoals } from "@/lib/goals";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getProfessionals } from "@/lib/professionals";
import { getSpecialties } from "@/lib/specialties";
import { parseStaffPermissions } from "@/lib/staff-permissions";
import { STUDENT_UNIT_LABELS, studentUnitLabel } from "@/lib/student-units";
import { StaffLoginManager } from "@/components/staff/staff-login-manager";
import { Toast } from "@/components/ui/toast";
import {
  addStudentProfessional,
  addStudentSpecialty,
  createStaffLogin,
  createStudentLogin,
  deleteStaffLogin,
  deleteStudentAccount,
  removeStudentProfessional,
  removeStudentSpecialty,
  updateStaffLogin,
  updateStudentGoals,
  updateStudentLogin,
  updateStudentProfile,
  updateStudentUnits
} from "../../students/actions";

const SAVED_MESSAGES: Record<string, string> = {
  perfil: "Dados do mentorado salvos.",
  areas: "Áreas atualizadas.",
  login: "Acesso atualizado.",
  equipe: "Equipe atualizada.",
  metas: "Metas atualizadas.",
  funcionario: "Acesso de funcionário atualizado."
};

const ERROR_MESSAGES: Record<string, string> = {
  areas: "Mantenha pelo menos uma área ativa.",
  login: "Informe um e-mail válido (e senha com pelo menos 8 caracteres para novos acessos).",
  senha: "A nova senha precisa ter pelo menos 8 caracteres.",
  emailExistente: "Este e-mail já está em uso por outro acesso.",
  limiteFuncionarios: "Limite de acessos de funcionários atingido.",
  limiteAcessos: "Limite de acessos completos (administrativos) atingido para este mentorado.",
  permissoes: "Marque ao menos uma parte do portal que o funcionário poderá acessar."
};

const UNIT_DESCRIPTIONS: Record<StudentUnitType, string> = {
  CLINIC: "Vendas e mensagens da clínica ou consultório.",
  MENTORSHIP: "Dados da mentoria, curso ou operação própria.",
  OTHER: "Outra empresa, projeto ou frente de acompanhamento."
};

export default async function StudentDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { saved?: string; error?: string; mail?: string };
}) {
  await requireAdmin();
  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: { users: { orderBy: { createdAt: "asc" } }, units: { orderBy: { createdAt: "asc" } } }
  });
  if (!student) notFound();
  const activeUnits = student.units.filter((unit) => unit.active);
  const studentLogins = student.users.filter((user) => user.role !== "STAFF");
  const staffLogins = student.users
    .filter((user) => user.role === "STAFF")
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active,
      permissions: parseStaffPermissions(user.permissions)
    }));
  const [metrics, professionals, specialties, goals] = await Promise.all([
    getDashboardData({ studentId: student.id }),
    getProfessionals(student.id),
    getSpecialties(student.id),
    getUnitGoals(activeUnits.map((unit) => unit.id))
  ]);

  const savedMessage = searchParams?.saved ? SAVED_MESSAGES[searchParams.saved] : undefined;
  const errorMessage = searchParams?.error ? ERROR_MESSAGES[searchParams.error] : undefined;
  const activeUnitTypes = new Set(student.units.filter((unit) => unit.active).map((unit) => unit.type));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin/students"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-champagne-700 transition hover:text-champagne-500"
          >
            <ArrowLeft size={15} />
            Mentorados
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{student.name}</h1>
          <p className="mt-1 text-sm text-graphite-700/70">
            {student.clinicName || "Sem clínica cadastrada"} · {student.active ? "Ativo" : "Inativo"}
          </p>
        </div>
      </header>

      {savedMessage ? (
        <Toast variant="success">
          {savedMessage}
          {searchParams?.mail === "ok" ? " As credenciais foram enviadas por e-mail." : null}
          {searchParams?.mail === "off" ? " Não foi possível enviar o e-mail — informe as credenciais manualmente." : null}
        </Toast>
      ) : null}
      {errorMessage ? (
        <Toast variant="error">{errorMessage}</Toast>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Vendas" value={formatCurrency(metrics.totalRevenue)} />
        <MetricCard label="Registros de vendas" value={formatNumber(metrics.totalFinanceEntries)} />
        <MetricCard label="Mensagens" value={formatNumber(metrics.totalMessageEntries)} />
        <MetricCard label="Conversão" value={formatPercent(metrics.conversionRate)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do mentorado</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateStudentProfile} className="grid gap-4">
              <input type="hidden" name="studentId" value={student.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome">
                  <Input name="name" required defaultValue={student.name} />
                </Field>
                <Field label="Clínica / empresa">
                  <Input name="clinicName" defaultValue={student.clinicName ?? ""} />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Telefone">
                  <Input name="phone" defaultValue={student.phone ?? ""} />
                </Field>
                <Field label="Status">
                  <Select name="active" defaultValue={student.active ? "true" : "false"}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </Select>
                </Field>
              </div>
              <label className="flex items-start gap-3 rounded-md border border-graphite-950/10 bg-white p-3 text-sm text-graphite-800">
                <Input
                  className="mt-0.5 h-4 w-4"
                  name="paymentChannelEnabled"
                  type="checkbox"
                  defaultChecked={student.paymentChannelEnabled}
                />
                <span>
                  <strong className="block text-ink">Canal de pagamento (opcional) na venda</strong>
                  <span className="text-graphite-700/70">
                    Libera, na Nova venda, um campo de texto livre para informar por qual canal o pagamento entrou (maquininha, link
                    de pagamento, Asaas...). Fica desligado por padrão — ative só se o mentorado pedir ao suporte.
                  </span>
                </span>
              </label>
              <div className="flex justify-end">
                <Button type="submit">
                  <Save size={16} />
                  Salvar dados
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Áreas de preenchimento</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateStudentUnits} className="grid gap-4">
              <input type="hidden" name="studentId" value={student.id} />
              <div className="grid gap-3">
                {(Object.keys(STUDENT_UNIT_LABELS) as StudentUnitType[]).map((type) => {
                  const existingUnit = student.units.find((unit) => unit.type === type);
                  return (
                    <div key={type} className="grid gap-2 rounded-md border border-graphite-950/10 bg-white p-3 text-sm text-graphite-800">
                      <label className="flex items-start gap-3">
                        <Input
                          className="mt-0.5 h-4 w-4"
                          name="unitTypes"
                          type="checkbox"
                          value={type}
                          defaultChecked={activeUnitTypes.has(type)}
                        />
                        <span>
                          <strong className="block text-ink">{STUDENT_UNIT_LABELS[type]}</strong>
                          <span className="text-graphite-700/70">{UNIT_DESCRIPTIONS[type]}</span>
                        </span>
                      </label>
                      {existingUnit ? (
                        <label className="grid gap-1.5 pl-7 text-xs font-semibold text-graphite-800">
                          Nome exibido no portal
                          <Input name={`unitName:${existingUnit.id}`} defaultValue={existingUnit.name} minLength={2} maxLength={80} />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-graphite-700/65">
                O nome exibido pode ser personalizado (ex.: &quot;Clínica Centro&quot;, &quot;Clínica Zona Sul&quot;). Desmarcar uma
                área apenas a desativa: os lançamentos existentes são preservados e voltam a aparecer se a área for reativada.
              </p>
              <div className="flex justify-end">
                <Button type="submit" variant="secondary">
                  <Save size={16} />
                  Salvar áreas
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target size={18} />
              Metas mensais de vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateStudentGoals} className="grid gap-4">
              <input type="hidden" name="studentId" value={student.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                {activeUnits.map((unit) => (
                  <Field key={unit.id} label={`Meta para ${studentUnitLabel(unit)} (R$/mês)`} hint="Deixe 0 para não acompanhar meta.">
                    <Input
                      name={`goal:${unit.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={goals.get(unit.id) || ""}
                      placeholder="0,00"
                    />
                  </Field>
                ))}
              </div>
              <p className="text-xs text-graphite-700/65">
                A meta aparece com barra de progresso no painel do mentorado e no quadro "Metas do mês" do dashboard.
              </p>
              <div className="flex justify-end">
                <Button type="submit" variant="secondary">
                  <Save size={16} />
                  Salvar metas
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound size={18} />
              Acessos ao portal
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {studentLogins.map((account) => (
              <form key={account.id} action={updateStudentLogin} className="grid gap-4 rounded-md border border-graphite-950/10 bg-graphite-950/[0.02] p-4">
                <input type="hidden" name="studentId" value={student.id} />
                <input type="hidden" name="userId" value={account.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="E-mail de login">
                    <Input name="email" type="email" required defaultValue={account.email} />
                  </Field>
                  <Field label="Nova senha" hint="Deixe em branco para manter a senha atual.">
                    <Input name="newPassword" type="password" minLength={8} autoComplete="new-password" placeholder="••••••••" />
                  </Field>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <Field label="Status do acesso">
                    <Select name="active" defaultValue={account.active ? "true" : "false"}>
                      <option value="true">Ativo</option>
                      <option value="false">Bloqueado</option>
                    </Select>
                  </Field>
                  <Button type="submit" variant="secondary">
                    <Save size={16} />
                    Salvar acesso
                  </Button>
                </div>
              </form>
            ))}

            <form action={createStudentLogin} className="grid gap-4 rounded-md border border-dashed border-graphite-950/15 p-4">
              <input type="hidden" name="studentId" value={student.id} />
              <p className="text-sm text-graphite-700/75">
                {studentLogins.length
                  ? "Crie mais um acesso completo (mesmo nível do login principal), se o mentorado pedir — por exemplo, para um sócio."
                  : "Este mentorado ainda não tem login. Crie um acesso abaixo."}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="E-mail de login">
                  <Input name="email" type="email" required />
                </Field>
                <Field label="Senha inicial">
                  <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit">
                  <UserPlus size={16} />
                  Criar acesso
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound size={18} />
              Funcionários (acesso limitado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StaffLoginManager
              staff={staffLogins}
              createAction={createStaffLogin}
              updateAction={updateStaffLogin}
              deleteAction={deleteStaffLogin}
              hiddenFields={{ studentId: student.id }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={18} />
              Equipe de profissionais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form action={addStudentProfessional} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="studentId" value={student.id} />
              <div className="flex-1">
                <Field label="Nome do profissional">
                  <Input name="name" required maxLength={80} placeholder="Ex.: Dra Ana Souza" />
                </Field>
              </div>
              <Button type="submit" variant="secondary" className="sm:w-auto">
                <UserPlus size={16} />
                Adicionar
              </Button>
            </form>
            {professionals.length ? (
              <ul className="grid gap-2">
                {professionals.map((name) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-md border border-graphite-950/10 bg-white px-4 py-2 text-sm font-medium text-graphite-800"
                  >
                    <span className="min-w-0 break-words">{name}</span>
                    <form action={removeStudentProfessional}>
                      <input type="hidden" name="studentId" value={student.id} />
                      <input type="hidden" name="name" value={name} />
                      <ConfirmSubmitButton
                        message={`Remover ${name} da equipe?`}
                        variant="ghost"
                        className="h-8 px-2 text-red-900 hover:bg-red-50 hover:text-red-900"
                      >
                        <Trash2 size={15} />
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-graphite-700/70">
                Nenhum profissional cadastrado. O mentorado também pode cadastrar a própria equipe na aba Equipe do portal.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award size={18} />
              Especialidades
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form action={addStudentSpecialty} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="studentId" value={student.id} />
              <div className="flex-1">
                <Field label="Nome da especialidade">
                  <Input name="name" required maxLength={80} placeholder="Ex.: Fisioterapia" />
                </Field>
              </div>
              <Button type="submit" variant="secondary" className="sm:w-auto">
                <UserPlus size={16} />
                Adicionar
              </Button>
            </form>
            {specialties.length ? (
              <ul className="grid gap-2">
                {specialties.map((name) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-md border border-graphite-950/10 bg-white px-4 py-2 text-sm font-medium text-graphite-800"
                  >
                    <span className="min-w-0 break-words">{name}</span>
                    <form action={removeStudentSpecialty}>
                      <input type="hidden" name="studentId" value={student.id} />
                      <input type="hidden" name="name" value={name} />
                      <ConfirmSubmitButton
                        message={`Remover ${name} da lista de especialidades?`}
                        variant="ghost"
                        className="h-8 px-2 text-red-900 hover:bg-red-50 hover:text-red-900"
                      >
                        <Trash2 size={15} />
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-graphite-700/70">
                Nenhuma especialidade cadastrada. O mentorado também pode cadastrar na aba Equipe do portal.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-red-900/25">
        <CardHeader className="bg-red-50/60">
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertTriangle size={18} />
            Zona de risco
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm text-graphite-700">
            Excluir o mentorado apaga definitivamente o perfil, os logins, as áreas, a equipe e todos os lançamentos de vendas,
            mensagens e custo/hora. Se a intenção for apenas pausar o acompanhamento, use o status Inativo.
          </p>
          <form action={deleteStudentAccount}>
            <input type="hidden" name="studentId" value={student.id} />
            <ConfirmSubmitButton
              message={`Excluir ${student.name} definitivamente? Todos os lançamentos serão apagados. Essa ação não pode ser desfeita.`}
            >
              <Trash2 size={16} />
              Excluir mentorado
            </ConfirmSubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
