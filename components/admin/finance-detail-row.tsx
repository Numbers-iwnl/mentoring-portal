"use client";

import { useState } from "react";
import { EditModal } from "@/components/forms/finance-entry-form";
import { Badge } from "@/components/ui/badge";
import type { PaymentForm } from "@/lib/payments";

/** Dados já formatados/serializáveis de uma venda, para a janela de detalhes do admin. */
export type FinanceDetail = {
  date: string;
  student: string;
  area: string;
  patientName: string;
  serviceType: string;
  description: string;
  specialty: string;
  total: number;
  payments: PaymentForm[] | null;
  legacyPayments: Array<{ label: string; amount: number }>;
  professional: string;
  closer: string;
  observations: string;
  refundAmount: number;
  refundedAt: string;
  mismatch: boolean;
  source: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function brDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function Item({ label, value, full = false }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite-700/60">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{value || "-"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-md border border-[rgba(0,6,35,0.08)] bg-graphite-950/[0.025] p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-champagne-700">{title}</h3>
      {children}
    </section>
  );
}

export function FinanceDetailRow({ detail, children }: { detail: FinanceDetail; children: React.ReactNode }) {
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
        title="Ver detalhes da venda"
        className="cursor-pointer transition hover:bg-champagne-500/[0.06]"
      >
        {children}
      </tr>
      <EditModal title="Detalhes da venda" open={open} onClose={() => setOpen(false)}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-ink">{detail.patientName || "Paciente não informado"}</p>
              <p className="text-sm text-graphite-700/70">
                {detail.student} · {detail.area}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums text-ink">{brl.format(detail.total)}</p>
              <div className="mt-1 flex flex-wrap justify-end gap-1">
                {detail.mismatch ? <Badge>Conferir</Badge> : <Badge variant="ok">OK</Badge>}
                {detail.refundAmount > 0 ? <Badge variant="danger">Estornado {brl.format(detail.refundAmount)}</Badge> : null}
              </div>
            </div>
          </div>

          <Section title="Venda">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item label="Data da venda" value={detail.date} />
              <Item label="Tipo de atendimento" value={detail.serviceType} />
              <Item label="Especialidade" value={detail.specialty} />
              <Item label="Área" value={detail.area} />
              <Item label="Descrição" value={detail.description} full />
            </dl>
          </Section>

          <Section title="Pagamento">
            {detail.payments?.length ? (
              <ul className="grid gap-2">
                {detail.payments.map((payment, index) => (
                  <li key={index} className="rounded-md border border-graphite-950/10 bg-white px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <strong className="text-ink">{payment.method}</strong>
                      <span className="font-semibold tabular-nums text-ink">{brl.format(payment.amount)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-graphite-700/70">
                      {payment.installments > 1 ? `${payment.installments}x (parcelas mensais)` : "À vista"}
                      {" · 1º recebimento "}
                      {brDate(payment.firstDate)}
                      {payment.channel ? ` · canal: ${payment.channel}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : detail.legacyPayments.length ? (
              <ul className="grid gap-1 text-sm">
                {detail.legacyPayments.map((payment) => (
                  <li key={payment.label} className="flex justify-between gap-3">
                    <span>{payment.label}</span>
                    <span className="tabular-nums">{brl.format(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-graphite-700/70">Nenhuma forma de pagamento informada.</p>
            )}
          </Section>

          <Section title="Responsáveis e observações">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item label="Responsável pelo agendamento" value={detail.professional} />
              <Item label="Profissional responsável pelo fechamento" value={detail.closer} />
              <Item label="Observações" value={detail.observations} full />
            </dl>
          </Section>

          {detail.refundAmount > 0 ? (
            <Section title="Estorno">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Item label="Valor estornado" value={brl.format(detail.refundAmount)} />
                <Item label="Registrado em" value={detail.refundedAt} />
              </dl>
            </Section>
          ) : null}

          <Section title="Registro">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item label="Origem do lançamento" value={detail.source} />
              <Item label="Registrado por" value={detail.createdBy} />
              <Item label="Criado em" value={detail.createdAt} />
              <Item label="Última alteração" value={detail.updatedAt} />
            </dl>
          </Section>
        </div>
      </EditModal>
    </>
  );
}
