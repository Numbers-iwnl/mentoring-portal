import { Award, KeyRound, LayoutGrid, Save, ShieldAlert, Trash2, UserPlus, Users } from "lucide-react";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Field, Input, Select } from "@/components/ui/field";
import { StaffLoginManager } from "@/components/staff/staff-login-manager";
import { blockStaff } from "@/lib/guards";
import { parseStaffPermissions } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { getProfessionals, MAX_PROFESSIONALS } from "@/lib/professionals";
import { getSpecialties, MAX_SPECIALTIES } from "@/lib/specialties";
import { getStudentUnits, STUDENT_UNIT_LABELS } from "@/lib/student-units";
import { Toast } from "@/components/ui/toast";
import {
  addProfessional,
  addSpecialty,
  createOwnAdminLogin,
  createOwnStaffLogin,
  deleteOwnStaffLogin,
  removeProfessional,
  removeSpecialty,
  renameOwnAreas,
  updateOwnAdminLogin,
  updateOwnStaffLogin
} from "./actions";

const SAVED_MESSAGES: Record<string, string> = {
  funcionario: "Acesso de funcionário atualizado.",
  areas: "Nomes das áreas atualizados.",
  admin: "Acesso de administrador atualizado."
};

const ERROR_MESSAGES: Record<string, string> = {
  login: "Informe nome, e-mail válido e senha com pelo menos 8 caracteres.",
  senha: "A nova senha precisa ter pelo menos 8 caracteres.",
  emailExistente: "Este e-mail já está em uso por outro acesso.",
  limiteFuncionarios: "Limite de acessos de funcionários atingido.",
  permissoes: "Marque ao menos uma parte do portal que o funcionário poderá acessar.",
  loginAdmin: "Informe um e-mail válido e senha com pelo menos 8 caracteres.",
  limiteAdmins: "Limite de acessos administrativos atingido.",
  emailExistenteAdmin: "Este e-mail já está em uso por outro acesso.",
  bloqueioProprio: "Você não pode bloquear o acesso que está usando agora.",
  ultimoAdmin: "É preciso manter ao menos um acesso administrativo ativo."
};

export default async function EquipePage({
  searchParams
}: {
  searchParams?: { saved?: string; error?: string; mail?: string };
}) {
  const { studentId } = await blockStaff();
  const [professionals, specialties, staffRows, adminRows, units] = await Promise.all([
    studentId ? getProfessionals(studentId) : Promise.resolve([]),
    studentId ? getSpecialties(studentId) : Promise.resolve([]),
    studentId
      ? prisma.user.findMany({
          where: { studentId, role: UserRole.STAFF },
          select: { id: true, name: true, email: true, active: true, permissions: true },
          orderBy: { createdAt: "asc" }
        })
      : Promise.resolve([]),
    studentId
      ? prisma.user.findMany({
          where: { studentId, role: UserRole.STUDENT },
          select: { id: true, email: true, active: true },
          orderBy: { createdAt: "asc" }
        })
      : Promise.resolve([]),
    studentId ? getStudentUnits(studentId) : Promise.resolve([])
  ]);
  const staff = staffRows.map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    active: account.active,
    permissions: parseStaffPermissions(account.permissions)
  }));

  const savedMessage = searchParams?.saved ? SAVED_MESSAGES[searchParams.saved] : undefined;
  const errorMessage = searchParams?.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Equipe</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Profissionais da sua operação</h1>
        <p className="mt-2 max-w-2xl text-sm text-graphite-700/75">
          Cadastre os profissionais da sua equipe. Eles aparecem como opção nos campos de responsável pelo agendamento e pelo fechamento,
          em vendas e mensagens de qualquer área.
        </p>
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

      {units.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid size={18} />
              Minhas áreas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={renameOwnAreas} className="grid gap-4">
              <p className="text-sm text-graphite-700/75">
                Renomeie as abas conforme a sua realidade — por exemplo, &quot;Clínica Centro&quot; e &quot;Clínica Zona Sul&quot;. O
                novo nome aparece em todo o portal.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {units.map((unit) => (
                  <Field key={unit.id} label={`Área (${STUDENT_UNIT_LABELS[unit.type]})`}>
                    <Input name={`unitName:${unit.id}`} defaultValue={unit.name} required minLength={2} maxLength={80} />
                  </Field>
                ))}
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="secondary">
                  <Save size={16} />
                  Salvar nomes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus size={18} />
            Adicionar profissional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addProfessional} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Nome do profissional">
                <Input name="name" required maxLength={80} placeholder="Ex.: Dra Ana Souza" />
              </Field>
            </div>
            <Button type="submit" className="sm:w-auto">
              <UserPlus size={16} />
              Adicionar
            </Button>
          </form>
          {professionals.length >= MAX_PROFESSIONALS ? (
            <p className="mt-3 text-sm text-red-900">Limite de {MAX_PROFESSIONALS} profissionais atingido. Remova alguém para adicionar outro.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} />
            Equipe cadastrada
          </CardTitle>
        </CardHeader>
        <CardContent>
          {professionals.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {professionals.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-3 rounded-md border border-graphite-950/10 bg-white px-4 py-2.5 text-sm font-medium text-graphite-800 shadow-sm"
                >
                  <span className="min-w-0 break-words">{name}</span>
                  <form action={removeProfessional}>
                    <input type="hidden" name="name" value={name} />
                    <ConfirmSubmitButton
                      message={`Remover ${name} da equipe? As vendas já registradas com esse nome não são alteradas.`}
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
              Nenhum profissional cadastrado ainda. Enquanto a lista estiver vazia, o campo Profissional aceita digitação livre.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award size={18} />
            Adicionar especialidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addSpecialty} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Nome da especialidade">
                <Input name="name" required maxLength={80} placeholder="Ex.: Fisioterapia" />
              </Field>
            </div>
            <Button type="submit" className="sm:w-auto">
              <UserPlus size={16} />
              Adicionar
            </Button>
          </form>
          {specialties.length >= MAX_SPECIALTIES ? (
            <p className="mt-3 text-sm text-red-900">Limite de {MAX_SPECIALTIES} especialidades atingido. Remova alguma para adicionar outra.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award size={18} />
            Especialidades cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {specialties.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {specialties.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-3 rounded-md border border-graphite-950/10 bg-white px-4 py-2.5 text-sm font-medium text-graphite-800 shadow-sm"
                >
                  <span className="min-w-0 break-words">{name}</span>
                  <form action={removeSpecialty}>
                    <input type="hidden" name="name" value={name} />
                    <ConfirmSubmitButton
                      message={`Remover ${name} da lista de especialidades? As vendas já registradas com essa especialidade não são alteradas.`}
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
              Nenhuma especialidade cadastrada ainda. Enquanto a lista estiver vazia, o campo Especialidade fica desabilitado na Nova
              venda.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound size={18} />
            Acessos de funcionários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StaffLoginManager
            staff={staff}
            createAction={createOwnStaffLogin}
            updateAction={updateOwnStaffLogin}
            deleteAction={deleteOwnStaffLogin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert size={18} />
            Outros administradores
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <p className="rounded-md border border-red-900/20 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
            Atenção: quem tiver esse acesso enxerga e controla tudo na sua conta — vendas, mensagens, custo/hora, equipe e
            histórico, além de poder criar e bloquear outros acessos administrativos. Adicione apenas pessoas de confiança total,
            como sócios ou gestores.
          </p>
          <form action={createOwnAdminLogin} className="grid gap-4 rounded-md border border-dashed border-graphite-950/15 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="E-mail de login">
                <Input name="email" type="email" required />
              </Field>
              <Field label="Senha inicial">
                <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="secondary">
                <UserPlus size={16} />
                Criar acesso de administrador
              </Button>
            </div>
          </form>

          {adminRows.length ? (
            <div className="grid gap-4">
              {adminRows.map((account) => (
                <form
                  key={account.id}
                  action={updateOwnAdminLogin}
                  className="grid gap-4 rounded-md border border-graphite-950/10 bg-graphite-950/[0.02] p-4"
                >
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
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
