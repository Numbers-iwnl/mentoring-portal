"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { draftsToPayments, emptyPaymentRow, PaymentSection, type PaymentRowDraft } from "@/components/forms/payment-section";
import { paymentsMatchTotal, paymentsSum, type PaymentForm } from "@/lib/payments";
import { SERVICE_TYPE_OPTIONS } from "@/lib/service-types";

/**
 * Client-side modal shell used by the edit panels (backdrop + scrollable
 * centered panel). Rendered through a portal to <body> — ancestors with
 * backdrop-filter (the Card) would otherwise become the containing block
 * for position:fixed and break the centering.
 */
export function EditModal({
  title,
  open,
  onClose,
  children
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-graphite-950/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-graphite-950/15 bg-ivory shadow-luxury">
        <div className="flex items-center justify-between gap-3 border-b border-graphite-950/10 bg-white px-5 py-3">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(0,6,35,0.12)] bg-white text-graphite-700 transition hover:border-champagne-500 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

type FormAction = (formData: FormData) => Promise<void>;

/** Plain (serializable) shape of a FinanceEntry for the client edit panel. */
export type FinanceEntryPlain = {
  id: string;
  date: string;
  patientName: string;
  /** Descrição livre (coluna `treatment`). */
  treatment: string;
  serviceType: string;
  specialty: string;
  total: number;
  payments: PaymentForm[] | null;
  professional: string;
  closer: string;
  observations: string;
  refundAmount: number;
  /** yyyy-MM-dd de quando o estorno foi registrado, ou "" quando não houve estorno. */
  refundedAtDisplay: string;
};

export const TEAM_LEGEND = "Cadastre sua equipe na aba Equipe para poder selecionar os profissionais neste campo.";
const SPECIALTY_LEGEND = "Cadastre as especialidades na aba Equipe para poder selecionar aqui.";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function parseInstallmentChoices(options: string[]) {
  const numbers = options
    .map((option) => Number.parseInt(option, 10))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 60);
  const unique = [...new Set([1, ...numbers])].sort((a, b) => a - b);
  return unique;
}

function withCurrentValue(options: string[], current?: string) {
  return current && !options.includes(current) ? [current, ...options] : options;
}

function paymentsToDrafts(payments: PaymentForm[] | null, fallbackTotal: number, fallbackDate: string): PaymentRowDraft[] {
  if (payments?.length) {
    return payments.map((payment) => ({
      method: payment.method,
      amount: String(payment.amount),
      installments: payment.installments,
      firstDate: payment.firstDate,
      channel: payment.channel ?? ""
    }));
  }
  return [{ ...emptyPaymentRow(fallbackDate), amount: fallbackTotal > 0 ? String(fallbackTotal) : "" }];
}

function FinanceEntryFields({
  action,
  unitId,
  professionals,
  specialties,
  installmentOptions,
  paymentChannelEnabled,
  entry,
  submitLabel,
  submitVariant = "primary",
  returnQuery,
  deleteAction,
  canDelete = true,
  canRefund = true
}: {
  action: FormAction;
  unitId?: string | null;
  professionals: string[];
  specialties: string[];
  installmentOptions: string[];
  paymentChannelEnabled: boolean;
  entry?: FinanceEntryPlain;
  submitLabel: string;
  submitVariant?: "primary" | "secondary";
  returnQuery?: string;
  deleteAction?: FormAction;
  canDelete?: boolean;
  /** Estorno é restrito a mentorado/admin — funcionário não vê nem altera esse campo. */
  canRefund?: boolean;
}) {
  const [dateValue, setDateValue] = useState(entry?.date ?? todayInput());
  const [total, setTotal] = useState(entry ? String(entry.total) : "");
  const [rows, setRows] = useState<PaymentRowDraft[]>(() =>
    paymentsToDrafts(entry?.payments ?? null, entry?.total ?? 0, entry?.date ?? todayInput())
  );
  const [refundAmount, setRefundAmount] = useState(entry?.refundAmount ? String(entry.refundAmount) : "");
  const [clientError, setClientError] = useState("");

  const installmentChoices = useMemo(() => parseInstallmentChoices(installmentOptions), [installmentOptions]);
  const teamMissing = professionals.length === 0;
  const specialtiesMissing = specialties.length === 0;

  const parsed = draftsToPayments(rows);
  const paymentsJson = "payments" in parsed ? JSON.stringify(parsed.payments) : "";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const totalNumber = Number(String(total).replace(",", ".")) || 0;
    if ("error" in parsed) {
      event.preventDefault();
      setClientError(parsed.error);
      return;
    }
    if (!paymentsMatchTotal(parsed.payments, totalNumber)) {
      event.preventDefault();
      setClientError(
        `A soma das formas de pagamento (R$ ${paymentsSum(parsed.payments).toFixed(2)}) precisa ser igual ao valor total da venda.`
      );
      return;
    }
    const refundNumber = Number(String(refundAmount).replace(",", ".")) || 0;
    if (refundNumber > totalNumber) {
      event.preventDefault();
      setClientError("O valor estornado não pode ser maior que o valor total da venda.");
      return;
    }
    setClientError("");
  };

  return (
    <form action={action} onSubmit={handleSubmit} className="grid gap-5">
      {unitId ? <input type="hidden" name="unitId" value={unitId} /> : null}
      {entry ? <input type="hidden" name="entryId" value={entry.id} /> : null}
      {returnQuery ? <input type="hidden" name="returnQuery" value={returnQuery} /> : null}
      <input type="hidden" name="payments" value={paymentsJson} />

      <section className="grid gap-4 rounded-md border border-[rgba(0,6,35,0.08)] bg-graphite-950/[0.025] p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-champagne-700">Venda</h3>
          <p className="mt-1 text-xs leading-5 text-graphite-700/65">Identifique aqui os principais dados da venda realizada.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-[180px_1fr_1fr]">
          <Field label="Data">
            <Input name="date" type="date" required value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
          </Field>
          <Field label="Paciente / Cliente">
            <Input name="patientName" placeholder="Nome do paciente" defaultValue={entry?.patientName ?? ""} />
          </Field>
          <Field label="Tipo de atendimento">
            <Select name="serviceType" defaultValue={entry?.serviceType ?? ""} required={!entry}>
              <option value="">Selecione</option>
              {SERVICE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Especialidade" hint="Se ainda não souber, pode deixar em branco e editar depois.">
            <Select name="specialty" defaultValue={entry?.specialty ?? ""} disabled={specialtiesMissing}>
              <option value="">Selecione</option>
              {withCurrentValue(specialties, entry?.specialty || undefined).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Descrição" hint="Texto livre: plano, número de sessões, detalhes do atendimento. Útil principalmente quando o tipo é Outros.">
          <Textarea
            name="treatment"
            rows={2}
            placeholder="Ex.: Plano de 10 sessões, primeira consulta, avaliação..."
            defaultValue={entry?.treatment ?? ""}
          />
        </Field>
        {specialtiesMissing ? (
          <p className="rounded-md border border-champagne-500/40 bg-champagne-100 px-3 py-2 text-sm font-semibold text-champagne-700">
            {SPECIALTY_LEGEND}
          </p>
        ) : null}
      </section>

      <PaymentSection
        rows={rows}
        onChange={setRows}
        total={total}
        onTotalChange={setTotal}
        installmentChoices={installmentChoices}
        defaultFirstDate={dateValue || todayInput()}
        channelEnabled={paymentChannelEnabled}
      />

      <section className="grid gap-4 rounded-md border border-[rgba(0,6,35,0.08)] bg-graphite-950/[0.025] p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-champagne-700">Responsáveis</h3>
        </div>
        {teamMissing ? (
          <p className="rounded-md border border-champagne-500/40 bg-champagne-100 px-3 py-2 text-sm font-semibold text-champagne-700">
            {TEAM_LEGEND}
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Responsável pelo agendamento" hint="Se ainda não souber, pode deixar em branco e editar depois.">
            <Select name="professional" defaultValue={entry?.professional ?? ""} disabled={teamMissing}>
              <option value="">Selecione</option>
              {withCurrentValue(professionals, entry?.professional || undefined).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Profissional responsável pelo fechamento da venda" hint="Se ainda não souber, pode deixar em branco e editar depois.">
            <Select name="closer" defaultValue={entry?.closer ?? ""} disabled={teamMissing}>
              <option value="">Selecione</option>
              {withCurrentValue(professionals, entry?.closer || undefined).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-xs leading-5 text-graphite-700/65">{TEAM_LEGEND}</p>
      </section>

      <section className="grid gap-4 rounded-md border border-[rgba(0,6,35,0.08)] bg-graphite-950/[0.025] p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-champagne-700">Observações</h3>
        </div>
        <Field label="Notas internas">
          <Textarea name="observations" placeholder="Detalhes relevantes para acompanhamento" defaultValue={entry?.observations ?? ""} />
        </Field>
      </section>

      {entry && canRefund ? (
        <section className="grid gap-3 rounded-md border border-red-900/15 bg-red-50/40 p-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={15} className="text-red-900/70" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-red-900/80">Estorno</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <Field label="Valor estornado" hint="Deixe em 0,00 se essa venda não teve estorno. Pode ser parcial (menor que o total).">
              <Input
                name="refundAmount"
                inputMode="decimal"
                placeholder="0,00"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
              />
            </Field>
            {entry.refundedAtDisplay ? (
              <p className="self-end pb-2 text-xs text-graphite-700/65">Estorno registrado em {entry.refundedAtDisplay}.</p>
            ) : null}
          </div>
        </section>
      ) : entry ? (
        // Funcionário não vê a seção de Estorno, mas o valor já registrado precisa continuar
        // sendo enviado junto do resto do formulário — senão a edição zeraria o estorno.
        <input type="hidden" name="refundAmount" value={String(entry.refundAmount ?? 0)} />
      ) : null}

      {clientError ? (
        <p className="rounded-md border border-red-900/20 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">{clientError}</p>
      ) : null}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-graphite-950/10 bg-white/90 p-3 shadow-soft backdrop-blur">
        {entry && deleteAction && canDelete ? (
          <ConfirmSubmitButton
            message="Excluir esta venda? Essa ação não pode ser desfeita."
            variant="danger"
            formAction={deleteAction}
            className="gap-1.5"
          >
            <Trash2 size={15} />
            Excluir
          </ConfirmSubmitButton>
        ) : (
          <p className="text-xs text-graphite-700/65">Confira o total e as formas de pagamento antes de salvar.</p>
        )}
        <Button type="submit" variant={submitVariant}>
          <Save size={16} />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function FinanceEntryForm({
  action,
  unitId,
  professionals = [],
  specialties = [],
  installmentOptions = [],
  paymentChannelEnabled = false
}: {
  action: FormAction;
  unitId?: string | null;
  professionals?: string[];
  specialties?: string[];
  installmentOptions?: string[];
  paymentChannelEnabled?: boolean;
}) {
  return (
    <FinanceEntryFields
      action={action}
      unitId={unitId}
      professionals={professionals}
      specialties={specialties}
      installmentOptions={installmentOptions}
      paymentChannelEnabled={paymentChannelEnabled}
      submitLabel="Salvar venda"
    />
  );
}

/**
 * Toda a linha da tabela de Vendas é clicável e abre o modal de edição — mesmo
 * padrão da tabela de Mensagens (ver MessageEntryRow). O Excluir mora dentro do
 * modal, junto do "Salvar edição", em vez de um botão solto na linha.
 */
export function FinanceEntryRow({
  entry,
  unitId,
  updateAction,
  deleteAction,
  professionals = [],
  specialties = [],
  installmentOptions = [],
  paymentChannelEnabled = false,
  canDelete = true,
  canRefund = true,
  returnQuery,
  children
}: {
  entry: FinanceEntryPlain;
  unitId?: string | null;
  updateAction: FormAction;
  deleteAction: FormAction;
  professionals?: string[];
  specialties?: string[];
  installmentOptions?: string[];
  paymentChannelEnabled?: boolean;
  canDelete?: boolean;
  canRefund?: boolean;
  returnQuery?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
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
        title="Editar venda"
        className="cursor-pointer transition hover:bg-champagne-500/[0.06]"
      >
        {children}
      </tr>
      <EditModal title="Editar venda" open={open} onClose={() => setOpen(false)}>
        <FinanceEntryFields
          action={updateAction}
          unitId={unitId}
          professionals={professionals}
          specialties={specialties}
          installmentOptions={installmentOptions}
          paymentChannelEnabled={paymentChannelEnabled}
          entry={entry}
          submitLabel="Salvar edição"
          submitVariant="secondary"
          returnQuery={returnQuery}
          deleteAction={deleteAction}
          canDelete={canDelete}
          canRefund={canRefund}
        />
      </EditModal>
    </>
  );
}
