import { KeyRound, Save, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Field, Input, Select } from "@/components/ui/field";
import { DEFAULT_STAFF_PERMISSIONS, STAFF_SECTIONS, type StaffSection } from "@/lib/staff-permissions";

type StaffAccount = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  permissions: StaffSection[];
};

type FormAction = (formData: FormData) => Promise<void>;

const SECTION_HINTS: Record<StaffSection, string> = {
  dashboard: "Indicadores e gráficos consolidados (valores).",
  financeiro: "Registrar vendas e editar o histórico.",
  mensagens: "Registrar mensagens / captação e editar o histórico.",
  custos: "Preencher e calcular custo/hora.",
  history: "Ver o histórico de registros (valores)."
};

function PermissionChecklist({ selected }: { selected: StaffSection[] }) {
  return (
    <fieldset className="grid gap-2 rounded-md border border-graphite-950/10 bg-white p-3">
      <legend className="px-1 text-xs font-semibold text-graphite-800">Acesso do funcionário</legend>
      <p className="px-1 text-xs text-graphite-700/65">Marque exatamente quais partes do portal este funcionário poderá abrir.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {STAFF_SECTIONS.map((section) => (
          <label key={section.key} className="flex items-start gap-2.5 rounded-md border border-[rgba(0,6,35,0.08)] bg-graphite-950/[0.015] p-2.5 text-sm text-graphite-800">
            <Input
              className="mt-0.5 h-4 w-4"
              name="permissions"
              type="checkbox"
              value={section.key}
              defaultChecked={selected.includes(section.key)}
            />
            <span>
              <strong className="block text-ink">{section.label}</strong>
              <span className="text-xs text-graphite-700/70">{SECTION_HINTS[section.key]}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="px-1 text-xs text-graphite-700/55">Minha conta (trocar a própria senha) fica sempre disponível.</p>
    </fieldset>
  );
}

/**
 * Shared manager for employee (STAFF) logins — used by the admin on the
 * student profile page and by the mentorado on the Equipe page. Each login is
 * granted exactly the portal sections chosen below.
 */
export function StaffLoginManager({
  staff,
  createAction,
  updateAction,
  deleteAction,
  hiddenFields = {}
}: {
  staff: StaffAccount[];
  createAction: FormAction;
  updateAction: FormAction;
  deleteAction: FormAction;
  hiddenFields?: Record<string, string>;
}) {
  const hidden = Object.entries(hiddenFields);

  return (
    <div className="grid gap-5">
      <p className="text-sm text-graphite-700/75">
        Funcionários entram com login próprio e acessam apenas as partes do portal que você marcar abaixo. As credenciais são
        enviadas por e-mail e a troca de senha é obrigatória no primeiro acesso.
      </p>

      <form action={createAction} className="grid gap-4 rounded-md border border-dashed border-graphite-950/15 p-4">
        {hidden.map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nome do funcionário">
            <Input name="name" required maxLength={120} placeholder="Ex.: Ana Recepção" />
          </Field>
          <Field label="E-mail de login">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Senha inicial">
            <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
        </div>
        <PermissionChecklist selected={[...DEFAULT_STAFF_PERMISSIONS]} />
        <div className="flex justify-end">
          <Button type="submit" variant="secondary">
            <UserPlus size={16} />
            Criar acesso de funcionário
          </Button>
        </div>
      </form>

      {staff.length ? (
        <div className="grid gap-4">
          {staff.map((account) => (
            <div key={account.id} className="grid gap-3 rounded-md border border-graphite-950/10 bg-graphite-950/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{account.name}</p>
                <form action={deleteAction}>
                  {hidden.map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={value} />
                  ))}
                  <input type="hidden" name="userId" value={account.id} />
                  <ConfirmSubmitButton
                    message={`Excluir o acesso de ${account.name}? Os lançamentos já registrados por essa pessoa são preservados.`}
                    variant="ghost"
                    className="h-8 px-2 text-xs text-red-900 hover:bg-red-50 hover:text-red-900"
                  >
                    <Trash2 size={14} />
                    Excluir acesso
                  </ConfirmSubmitButton>
                </form>
              </div>
              <form action={updateAction} className="grid gap-3">
                {hidden.map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <input type="hidden" name="userId" value={account.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nome do funcionário">
                    <Input name="name" required maxLength={120} defaultValue={account.name} />
                  </Field>
                  <Field label="E-mail de login">
                    <Input name="email" type="email" required defaultValue={account.email} />
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nova senha" hint="Em branco para manter.">
                    <Input name="newPassword" type="password" minLength={8} autoComplete="new-password" placeholder="••••••••" />
                  </Field>
                  <Field label="Status">
                    <Select name="active" defaultValue={account.active ? "true" : "false"}>
                      <option value="true">Ativo</option>
                      <option value="false">Bloqueado</option>
                    </Select>
                  </Field>
                </div>
                <PermissionChecklist selected={account.permissions} />
                <div className="flex justify-end">
                  <Button type="submit" variant="secondary" className="h-9 px-3 text-xs">
                    <Save size={14} />
                    Salvar funcionário
                  </Button>
                </div>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-graphite-700/70">
          <KeyRound size={15} />
          Nenhum acesso de funcionário criado ainda.
        </p>
      )}
    </div>
  );
}
