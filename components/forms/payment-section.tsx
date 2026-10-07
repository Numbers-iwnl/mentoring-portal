"use client";

import { useMemo } from "react";
import { CalendarClock, HelpCircle, Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { MONTH_LABELS } from "@/lib/constants";
import {
  MAX_PAYMENT_FORMS,
  methodAllowsInstallments,
  paymentsSum,
  projectionByMonth,
  validatePayments,
  PAYMENT_METHODS,
  type PaymentForm
} from "@/lib/payments";

export type PaymentRowDraft = {
  method: string;
  amount: string;
  installments: number;
  firstDate: string;
  channel: string;
};

export function emptyPaymentRow(firstDate: string): PaymentRowDraft {
  return { method: "", amount: "", installments: 1, firstDate, channel: "" };
}

export function draftsToPayments(rows: PaymentRowDraft[]) {
  return validatePayments(
    rows.map((row) => ({
      method: row.method,
      amount: Number(String(row.amount).replace(",", ".")),
      installments: row.installments,
      firstDate: row.firstDate,
      channel: row.channel
    }))
  );
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_LABELS[month - 1].slice(0, 3)}/${year}`;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PaymentSection({
  rows,
  onChange,
  total,
  onTotalChange,
  installmentChoices,
  defaultFirstDate,
  channelEnabled = false
}: {
  rows: PaymentRowDraft[];
  onChange: (rows: PaymentRowDraft[]) => void;
  total: string;
  onTotalChange: (total: string) => void;
  installmentChoices: number[];
  defaultFirstDate: string;
  channelEnabled?: boolean;
}) {
  const parsed = useMemo(() => draftsToPayments(rows), [rows]);
  const validPayments: PaymentForm[] | null = "payments" in parsed ? parsed.payments : null;
  const totalNumber = Number(String(total).replace(",", ".")) || 0;
  const sum = validPayments ? paymentsSum(validPayments) : null;
  const sumMatches = validPayments != null && Math.abs((sum ?? 0) - totalNumber) <= 0.009 && totalNumber > 0;

  const projection = useMemo(() => {
    if (!validPayments) return [] as Array<{ monthKey: string; amount: number }>;
    return [...projectionByMonth(validPayments).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, amount]) => ({ monthKey, amount }));
  }, [validPayments]);

  const updateRow = (index: number, patch: Partial<PaymentRowDraft>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <section className="grid min-w-0 gap-4 rounded-md border border-[rgba(0,6,35,0.08)] bg-graphite-950/[0.025] p-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-champagne-700">Pagamento</h3>
        <p className="mt-1 text-xs leading-5 text-graphite-700/65">
          Informe o valor total da venda e as formas de pagamento utilizadas.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-md border border-graphite-950/10 bg-white/70 p-3">
          <label className="grid gap-1.5 text-sm font-semibold text-graphite-800">
            Valor total da venda (R$)
            <Input
              name="total"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={total}
              onChange={(event) => onTotalChange(event.target.value)}
              className="font-semibold"
            />
          </label>
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite-700">Formas de pagamento</p>
              <p className="text-xs text-graphite-700/60">Você pode dividir o pagamento em até {MAX_PAYMENT_FORMS} formas.</p>
            </div>
            <button
              type="button"
              onClick={() => onChange([...rows, emptyPaymentRow(defaultFirstDate)])}
              disabled={rows.length >= MAX_PAYMENT_FORMS}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[rgba(0,6,35,0.12)] bg-white px-3 text-xs font-semibold text-graphite-800 shadow-sm transition hover:border-champagne-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} />
              Adicionar forma de pagamento
            </button>
          </div>

          <div className="grid gap-3">
            {rows.map((row, index) => {
              const allowsInstallments = row.method !== "" && methodAllowsInstallments(row.method as never);
              return (
                <div key={index} className="grid min-w-0 gap-3 rounded-md border border-graphite-950/10 bg-white/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-graphite-700/60">
                      Forma {index + 1}
                    </p>
                    <button
                      type="button"
                      aria-label="Remover forma de pagamento"
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                      disabled={rows.length <= 1}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-900/20 bg-red-50 text-red-900 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-graphite-800">
                      Tipo de pagamento
                      <Select
                        required
                        value={row.method}
                        onChange={(event) => {
                          const method = event.target.value;
                          const allows = method !== "" && methodAllowsInstallments(method as never);
                          updateRow(index, { method, installments: allows ? row.installments : 1 });
                        }}
                      >
                        <option value="">Selecione</option>
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-graphite-800">
                      Valor (R$)
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={row.amount}
                        onChange={(event) => updateRow(index, { amount: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-graphite-800">
                      Parcelas
                      <Select
                        value={String(row.installments)}
                        disabled={!allowsInstallments}
                        onChange={(event) => updateRow(index, { installments: Number(event.target.value) })}
                      >
                        {(allowsInstallments ? installmentChoices : [1]).map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}x
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-graphite-800">
                      Primeiro recebimento
                      <Input
                        type="date"
                        required
                        className="min-w-0"
                        value={row.firstDate}
                        onChange={(event) => updateRow(index, { firstDate: event.target.value })}
                      />
                    </label>
                    <div className="grid min-w-0 gap-1.5 text-xs font-semibold text-graphite-800">
                      Frequência
                      <div className="flex h-11 items-center rounded-md border border-graphite-950/10 bg-graphite-950/[0.035] px-3 text-xs text-graphite-700">
                        {row.installments > 1 ? "Mensal" : "À vista"}
                      </div>
                    </div>
                  </div>
                  {channelEnabled ? (
                    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-graphite-800 sm:max-w-xs">
                      <span className="flex items-center gap-1.5">
                        Canal de pagamento (opcional)
                        <span className="group relative inline-flex">
                          <HelpCircle size={13} className="text-graphite-700/40" tabIndex={0} aria-label="Sobre canal de pagamento" />
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-[min(17rem,calc(100vw-2rem))] rounded-md border border-white/10 bg-graphite-850 p-3 text-left text-xs font-medium normal-case leading-5 tracking-normal text-ivory/90 shadow-luxury group-hover:block group-focus-within:block"
                          >
                            Informe, se desejar, por qual canal o pagamento foi recebido (ex.: maquininha, link de pagamento Asaas,
                            Eduzz, Mercado Pago, PagSeguro).
                          </span>
                        </span>
                      </span>
                      <Input
                        value={row.channel}
                        maxLength={40}
                        placeholder="Ex.: maquininha, link de pagamento Asaas, Eduzz, Mercado Pago, PagSeguro"
                        onChange={(event) => updateRow(index, { channel: event.target.value })}
                      />
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {totalNumber > 0 && validPayments && !sumMatches ? (
        <p className="rounded-md border border-red-900/20 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
          A soma das formas de pagamento ({currency.format(sum ?? 0)}) precisa ser igual ao valor total da venda (
          {currency.format(totalNumber)}).
        </p>
      ) : null}
      {"error" in parsed && rows.some((row) => row.method || row.amount) ? (
        <p className="text-xs font-semibold text-red-900">{parsed.error}</p>
      ) : null}

      <div className="min-w-0 rounded-md border border-graphite-950/10 bg-white/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-graphite-950/10 bg-graphite-950/[0.04] text-graphite-700">
              <CalendarClock size={18} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne-700">Faturamento estimado</p>
              <p className="text-xs text-graphite-700/65">Calculado automaticamente com base nas datas de recebimento informadas.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-graphite-700/60">Total a receber</p>
            <p className="text-lg font-semibold text-ink">{currency.format(sumMatches ? totalNumber : (sum ?? 0))}</p>
          </div>
        </div>

        {projection.length ? (
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto border-t border-[rgba(0,6,35,0.08)] pt-3">
            {projection.map(({ monthKey, amount }) => (
              <div key={monthKey} className="min-w-[104px] shrink-0 rounded-md bg-graphite-950/[0.03] px-3 py-2">
                <p className="text-xs font-semibold text-ink">{monthLabel(monthKey)}</p>
                <p className="text-sm font-semibold text-graphite-800">{currency.format(amount)}</p>
                <p className="text-xs text-graphite-700/60">{sum ? `${Math.round((amount / sum) * 100)}%` : ""}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 border-t border-[rgba(0,6,35,0.08)] pt-3 text-xs text-graphite-700/55">
            Preencha as formas de pagamento para ver a projeção mês a mês.
          </p>
        )}

        <p className="mt-3 text-xs text-graphite-700/55">
          Os valores acima são uma estimativa de recebimento e podem variar conforme antecipações, taxas e cancelamentos.
        </p>
      </div>
    </section>
  );
}
