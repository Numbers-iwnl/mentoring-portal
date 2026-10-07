"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EditModal } from "@/components/forms/finance-entry-form";
import {
  APPROACH_OPTIONS,
  ATTENDED_OPTIONS,
  DISCARD_REASON_OTHER,
  DISCARD_STATUS_OPTIONS,
  MESSAGE_STATUS_OPTIONS,
  SCHEDULED_OPTIONS
} from "@/lib/constants";

type FormAction = (formData: FormData) => Promise<void>;

/** Plain (serializable) shape of a MessageEntry for the client edit panel. */
export type MessageEntryPlain = {
  id: string;
  date: string;
  name: string;
  contact: string;
  type: string;
  channel: string;
  approach: string;
  scheduledBy: string;
  professional: string;
  reason: string;
  scheduled: "Sim" | "Não" | "";
  attended: "Sim" | "Não" | "Remarcou" | "";
  discardStatus: string;
  discardReason: string;
  discardReasonOther: string;
  bookedTreatment: "Sim" | "Não" | "";
  status: string;
  observations: string;
};

const TEAM_LEGEND = "Cadastre sua equipe na aba Equipe para poder selecionar os profissionais neste campo.";

function withCurrentValue(options: string[], current?: string) {
  return current && !options.includes(current) ? [current, ...options] : options;
}

function ResponsibleSelects({
  professionals,
  scheduledBy,
  professional
}: {
  professionals: string[];
  scheduledBy?: string;
  professional?: string;
}) {
  const teamMissing = professionals.length === 0;
  return (
    <>
      {teamMissing ? (
        <p className="rounded-md border border-champagne-500/40 bg-champagne-100 px-3 py-2 text-sm font-semibold text-champagne-700">
          {TEAM_LEGEND}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Responsável pelo Agendamento" hint="Se ainda não souber, pode deixar em branco e editar depois.">
          <Select name="scheduledBy" defaultValue={scheduledBy ?? ""} disabled={teamMissing}>
            <option value="">Selecione</option>
            {withCurrentValue(professionals, scheduledBy || undefined).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Profissional responsável pelo fechamento da venda" hint="Se ainda não souber, pode deixar em branco e editar depois.">
          <Select name="professional" defaultValue={professional ?? ""} disabled={teamMissing}>
            <option value="">Selecione</option>
            {withCurrentValue(professionals, professional || undefined).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs leading-5 text-graphite-700/65">{TEAM_LEGEND}</p>
    </>
  );
}

/**
 * Status do lead: Abordagem / Atendeu ou respondeu / Descarte / Marcou Tratamento — independentes entre si e
 * independentes de "Agendou?". Não fazem parte do fluxo normal de cadastro (raramente já se
 * sabe a resposta na hora de registrar um contato novo); ficam em branco até serem preenchidos
 * ou editados depois. Motivo de Descarte só aparece depois que "Contato descartado" é escolhido.
 */
function LeadStatusFields({
  approach,
  onApproachChange,
  attended,
  onAttendedChange,
  bookedTreatment,
  onBookedTreatmentChange,
  discardStatus,
  onDiscardStatusChange,
  discardReason,
  onDiscardReasonChange,
  discardReasonOptions,
  discardReasonOther,
  onDiscardReasonOtherChange
}: {
  approach: string;
  onApproachChange: (value: string) => void;
  attended: string;
  onAttendedChange: (value: string) => void;
  bookedTreatment: string;
  onBookedTreatmentChange: (value: string) => void;
  discardStatus: string;
  onDiscardStatusChange: (value: string) => void;
  discardReason: string;
  onDiscardReasonChange: (value: string) => void;
  discardReasonOptions: string[];
  discardReasonOther: string;
  onDiscardReasonOtherChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Abordagem">
          <Select name="approach" value={approach} onChange={(event) => onApproachChange(event.target.value)}>
            <option value="">Selecione</option>
            {APPROACH_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Atendeu ou respondeu?">
          <Select name="attended" value={attended} onChange={(event) => onAttendedChange(event.target.value)}>
            <option value="">Selecione</option>
            {ATTENDED_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Descarte">
          <Select name="discardStatus" value={discardStatus} onChange={(event) => onDiscardStatusChange(event.target.value)}>
            <option value="">Selecione</option>
            {DISCARD_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Marcou Tratamento?">
          <Select name="bookedTreatment" value={bookedTreatment} onChange={(event) => onBookedTreatmentChange(event.target.value)}>
            <option value="">Selecione</option>
            {SCHEDULED_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {discardStatus === "Contato descartado" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Motivo de Descarte">
            <Select name="discardReason" value={discardReason} onChange={(event) => onDiscardReasonChange(event.target.value)}>
              <option value="">Selecione</option>
              {[...discardReasonOptions, DISCARD_REASON_OTHER].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          {discardReason === DISCARD_REASON_OTHER ? (
            <Field label="Qual motivo?">
              <Input
                name="discardReasonOther"
                value={discardReasonOther}
                maxLength={120}
                placeholder="Descreva o motivo do descarte"
                onChange={(event) => onDiscardReasonOtherChange(event.target.value)}
              />
            </Field>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MessageEntryForm({
  action,
  unitId,
  typeOptions = [],
  channelOptions = [],
  discardReasonOptions = [],
  professionals = []
}: {
  action: FormAction;
  unitId?: string | null;
  typeOptions?: string[];
  channelOptions?: string[];
  discardReasonOptions?: string[];
  professionals?: string[];
}) {
  const [scheduled, setScheduled] = useState("");
  const [attended, setAttended] = useState("");
  const [approach, setApproach] = useState("");
  const [bookedTreatment, setBookedTreatment] = useState("");
  const [discardStatus, setDiscardStatus] = useState("");
  const [discardReason, setDiscardReason] = useState("");
  const [discardReasonOther, setDiscardReasonOther] = useState("");

  return (
    <form action={action} className="grid gap-5">
      {unitId ? <input type="hidden" name="unitId" value={unitId} /> : null}
      <FormSection title="Contato" description="Registre quem entrou no funil e como encontrar essa pessoa depois.">
        <div className="grid gap-4 md:grid-cols-[180px_1fr_1fr]">
          <Field label="Data">
            <Input name="date" type="date" required />
          </Field>
          <Field label="Nome">
            <Input name="name" placeholder="Nome do contato" />
          </Field>
          <Field label="Contato">
            <Input name="contact" placeholder="Telefone, e-mail ou @perfil" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Qualificação" description="Esses campos alimentam conversão, pendências e follow-up no dashboard.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Tipo">
            <Select name="type" defaultValue="">
              <option value="">Selecione</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Origem">
            <Select name="channel" defaultValue="">
              <option value="">Selecione</option>
              {channelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Agendou?">
            <Select name="scheduled" value={scheduled} onChange={(event) => setScheduled(event.target.value)}>
              <option value="">Selecione</option>
              {SCHEDULED_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="">
              <option value="">Selecione</option>
              {MESSAGE_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Agendamento" description="Quem agendou e quem vai fechar a venda, e o motivo do contato.">
        <ResponsibleSelects professionals={professionals} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Motivo">
            <Input name="reason" placeholder="Motivo do contato ou objeção" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Status do lead" description="Esses campos são opcionais — geralmente não dá pra saber a resposta ao cadastrar um contato novo, então pode deixar em branco agora e preencher ou editar depois.">
        <LeadStatusFields
          approach={approach}
          onApproachChange={setApproach}
          attended={attended}
          onAttendedChange={setAttended}
          bookedTreatment={bookedTreatment}
          onBookedTreatmentChange={setBookedTreatment}
          discardStatus={discardStatus}
          onDiscardStatusChange={setDiscardStatus}
          discardReason={discardReason}
          onDiscardReasonChange={setDiscardReason}
          discardReasonOptions={discardReasonOptions}
          discardReasonOther={discardReasonOther}
          onDiscardReasonOtherChange={setDiscardReasonOther}
        />
      </FormSection>

      <FormSection title="Observações">
        <Field label="Notas de follow-up">
          <Textarea name="observations" placeholder="Notas de follow-up" />
        </Field>
      </FormSection>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-md border border-graphite-950/10 bg-white/90 p-3 shadow-soft backdrop-blur">
        <Button type="submit">
          <Save size={16} />
          Salvar mensagem
        </Button>
      </div>
    </form>
  );
}

/**
 * Toda a linha da tabela de Mensagens é clicável e abre o modal de edição
 * (o Excluir mora dentro do modal, não mais como botão solto na linha).
 * As células de exibição vêm do server component (page.tsx) via `children`,
 * assim a query/mapeamento continua lá — este componente só cuida do
 * comportamento clicável e do formulário do modal.
 */
export function MessageEntryRow({
  entry,
  unitId,
  updateAction,
  deleteAction,
  typeOptions = [],
  channelOptions = [],
  discardReasonOptions = [],
  professionals = [],
  canDelete = true,
  returnQuery,
  children
}: {
  entry: MessageEntryPlain;
  unitId?: string | null;
  updateAction: FormAction;
  deleteAction: FormAction;
  typeOptions?: string[];
  channelOptions?: string[];
  discardReasonOptions?: string[];
  professionals?: string[];
  canDelete?: boolean;
  returnQuery?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [scheduled, setScheduled] = useState(entry.scheduled);
  const [attended, setAttended] = useState(entry.attended);
  const [approach, setApproach] = useState(entry.approach);
  const [bookedTreatment, setBookedTreatment] = useState(entry.bookedTreatment);
  const [discardStatus, setDiscardStatus] = useState(entry.discardStatus);
  const [discardReason, setDiscardReason] = useState(entry.discardReason);
  const [discardReasonOther, setDiscardReasonOther] = useState(entry.discardReasonOther);
  return (
    <>
      <tr
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        title="Editar contato"
        className="group cursor-pointer transition hover:bg-champagne-500/[0.06]"
      >
        {children}
      </tr>
      <EditModal title="Editar contato" open={open} onClose={() => setOpen(false)}>
        <form action={updateAction} className="grid gap-3">
          <input type="hidden" name="entryId" value={entry.id} />
          {unitId ? <input type="hidden" name="unitId" value={unitId} /> : null}
          {returnQuery ? <input type="hidden" name="returnQuery" value={returnQuery} /> : null}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Data">
              <Input name="date" type="date" required defaultValue={entry.date} />
            </Field>
            <Field label="Nome">
              <Input name="name" defaultValue={entry.name} />
            </Field>
            <Field label="Contato">
              <Input name="contact" defaultValue={entry.contact} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Field label="Tipo">
              <Select name="type" defaultValue={entry.type}>
                <option value="">Selecione</option>
                {withCurrentValue(typeOptions, entry.type || undefined).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Origem">
              <Select name="channel" defaultValue={entry.channel}>
                <option value="">Selecione</option>
                {withCurrentValue(channelOptions, entry.channel || undefined).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Agendou?">
              <Select name="scheduled" value={scheduled} onChange={(event) => setScheduled(event.target.value as "Sim" | "Não" | "")}>
                <option value="">Selecione</option>
                {SCHEDULED_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={entry.status}>
                <option value="">Selecione</option>
                {MESSAGE_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <ResponsibleSelects
            professionals={professionals}
            scheduledBy={entry.scheduledBy || undefined}
            professional={entry.professional || undefined}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Motivo">
              <Input name="reason" defaultValue={entry.reason} />
            </Field>
          </div>
          <FormSection title="Status do lead" description="Opcionais — pode deixar em branco e voltar aqui depois para atualizar.">
            <LeadStatusFields
              approach={approach}
              onApproachChange={setApproach}
              attended={attended}
              onAttendedChange={(value) => setAttended(value as "Sim" | "Não" | "Remarcou" | "")}
              bookedTreatment={bookedTreatment}
              onBookedTreatmentChange={(value) => setBookedTreatment(value as "Sim" | "Não" | "")}
              discardStatus={discardStatus}
              onDiscardStatusChange={setDiscardStatus}
              discardReason={discardReason}
              onDiscardReasonChange={setDiscardReason}
              discardReasonOptions={discardReasonOptions}
              discardReasonOther={discardReasonOther}
              onDiscardReasonOtherChange={setDiscardReasonOther}
            />
          </FormSection>
          <Field label="Observações">
            <Textarea name="observations" defaultValue={entry.observations} />
          </Field>
          <div className="flex items-center justify-between gap-3">
            {canDelete ? (
              <ConfirmSubmitButton
                message="Excluir este contato? Essa ação não pode ser desfeita."
                variant="danger"
                formAction={deleteAction}
                className="gap-1.5"
              >
                <Trash2 size={15} />
                Excluir
              </ConfirmSubmitButton>
            ) : (
              <span />
            )}
            <Button type="submit" variant="secondary">
              <Save size={15} />
              Salvar edição
            </Button>
          </div>
        </form>
      </EditModal>
    </>
  );
}

function FormSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-md border border-[rgba(0,6,35,0.08)] bg-graphite-950/[0.025] p-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-champagne-700">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-5 text-graphite-700/65">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
