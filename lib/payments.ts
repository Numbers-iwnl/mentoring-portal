import type { Prisma } from "@prisma/client";

/**
 * Structured payment forms for a sale (up to MAX_PAYMENT_FORMS), stored as
 * JSON on FinanceEntry.payments. Receipts derived from parcelas + first
 * receipt date feed the "Faturamento Estimado" indicator.
 *
 * This module is pure (no server imports) so client components can reuse the
 * same math for the live projection strip in the sale form.
 */
export const PAYMENT_METHODS = [
  "Dinheiro",
  "PIX",
  "Transferência Bancária (TED/DOC)",
  "Cartão de Débito",
  "Cartão de Crédito",
  "Boleto Bancário",
  "Cheque"
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const INSTALLABLE_METHODS: readonly PaymentMethod[] = ["Cartão de Crédito", "Boleto Bancário", "Cheque"];

export const MAX_PAYMENT_FORMS = 2;
export const MAX_INSTALLMENTS = 60;

export const MAX_PAYMENT_CHANNEL_LENGTH = 40;

export type PaymentForm = {
  method: PaymentMethod;
  amount: number;
  installments: number;
  /** yyyy-MM-dd of the first expected receipt */
  firstDate: string;
  /** Optional channel the payment was received through (maquininha, link, Asaas...) */
  channel?: string;
};

export type Receipt = {
  dueDate: Date;
  monthKey: string;
  amount: number;
  method: PaymentMethod;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function methodAllowsInstallments(method: PaymentMethod) {
  return INSTALLABLE_METHODS.includes(method);
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function paymentsSum(payments: PaymentForm[]) {
  return round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
}

export function paymentsMatchTotal(payments: PaymentForm[], total: number) {
  return Math.abs(paymentsSum(payments) - round2(total)) <= 0.009;
}

/** Validates raw data (e.g. parsed JSON from the form). Returns error in pt-BR or the clean list. */
export function validatePayments(raw: unknown): { payments: PaymentForm[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Informe pelo menos uma forma de pagamento." };
  }
  if (raw.length > MAX_PAYMENT_FORMS) {
    return { error: `O pagamento pode ser dividido em no máximo ${MAX_PAYMENT_FORMS} formas.` };
  }

  const payments: PaymentForm[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Forma de pagamento inválida." };
    }
    const data = item as Record<string, unknown>;
    if (!isPaymentMethod(data.method)) {
      return { error: "Selecione o tipo de pagamento em todas as formas." };
    }
    const amount = round2(Number(String(data.amount ?? "").toString().replace(",", ".")));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "Informe um valor maior que zero em todas as formas de pagamento." };
    }
    const installments = Number(data.installments ?? 1);
    if (!Number.isInteger(installments) || installments < 1 || installments > MAX_INSTALLMENTS) {
      return { error: "Número de parcelas inválido." };
    }
    if (installments > 1 && !methodAllowsInstallments(data.method)) {
      return { error: `${data.method} não permite parcelamento.` };
    }
    const firstDate = String(data.firstDate ?? "");
    if (!DATE_PATTERN.test(firstDate) || Number.isNaN(Date.parse(`${firstDate}T12:00:00Z`))) {
      return { error: "Informe a data do primeiro recebimento em todas as formas." };
    }
    const channel = String(data.channel ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PAYMENT_CHANNEL_LENGTH);
    payments.push({ method: data.method, amount, installments, firstDate, ...(channel ? { channel } : {}) });
  }
  return { payments };
}

function addMonthsClamped(year: number, month: number, day: number, offset: number) {
  const target = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
  const daysInTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, daysInTarget), 12));
}

/** Expands each payment form into its expected receipts (monthly frequency). */
export function expandReceipts(payments: PaymentForm[]): Receipt[] {
  const receipts: Receipt[] = [];
  for (const payment of payments) {
    const [year, month, day] = payment.firstDate.split("-").map(Number);
    const parcel = round2(payment.amount / payment.installments);
    // Distribute the rounding remainder into the first parcel so parcels sum exactly.
    const firstParcel = round2(payment.amount - parcel * (payment.installments - 1));
    for (let index = 0; index < payment.installments; index += 1) {
      const dueDate = addMonthsClamped(year, month, day, index);
      receipts.push({
        dueDate,
        monthKey: `${dueDate.getUTCFullYear()}-${String(dueDate.getUTCMonth() + 1).padStart(2, "0")}`,
        amount: index === 0 ? firstParcel : parcel,
        method: payment.method
      });
    }
  }
  return receipts.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export function receiptsInRange(payments: PaymentForm[], start: Date, end: Date) {
  return round2(
    expandReceipts(payments)
      .filter((receipt) => receipt.dueDate >= start && receipt.dueDate <= end)
      .reduce((sum, receipt) => sum + receipt.amount, 0)
  );
}

/** Month-by-month projection used by the form strip. */
export function projectionByMonth(payments: PaymentForm[]) {
  const byMonth = new Map<string, number>();
  for (const receipt of expandReceipts(payments)) {
    byMonth.set(receipt.monthKey, round2((byMonth.get(receipt.monthKey) ?? 0) + receipt.amount));
  }
  return byMonth;
}

/** Reads payments stored in FinanceEntry.payments (returns null for legacy entries). */
export function readStoredPayments(value: Prisma.JsonValue | null | undefined): PaymentForm[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const forms = (value as Record<string, unknown>).forms;
  const result = validatePayments(forms);
  return "payments" in result ? result.payments : null;
}

export function serializePayments(payments: PaymentForm[]): Prisma.InputJsonValue {
  return { version: 1, forms: payments.map((payment) => ({ ...payment })) };
}

/** Short human summary, e.g. "PIX R$ 500,00 (maquininha) · Cartão de Crédito 5x R$ 4.500,00". */
export function paymentsSummary(payments: PaymentForm[]) {
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  return payments
    .map((payment) => {
      const base =
        payment.installments > 1
          ? `${payment.method} ${payment.installments}x ${currency.format(payment.amount)}`
          : `${payment.method} ${currency.format(payment.amount)}`;
      return payment.channel ? `${base} (${payment.channel})` : base;
    })
    .join(" · ");
}

/** Maps the structured forms onto the legacy per-method columns (kept for compatibility). */
export function legacyColumnsFromPayments(payments: PaymentForm[]) {
  const columns = { cash: 0, pix: 0, card: 0, transfer: 0 };
  for (const payment of payments) {
    if (payment.method === "Dinheiro") columns.cash = round2(columns.cash + payment.amount);
    else if (payment.method === "PIX") columns.pix = round2(columns.pix + payment.amount);
    else if (payment.method === "Cartão de Crédito" || payment.method === "Cartão de Débito") {
      columns.card = round2(columns.card + payment.amount);
    } else if (payment.method === "Transferência Bancária (TED/DOC)") {
      columns.transfer = round2(columns.transfer + payment.amount);
    }
    // Boleto Bancário e Cheque não têm coluna legada — ficam apenas no JSON.
  }
  return columns;
}
