import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { toNumber } from "./format";
import { paymentsSum, readStoredPayments } from "./payments";
import { APPROACH_OPTIONS, ATTENDED_OPTIONS, DISCARD_STATUS_OPTIONS, MESSAGE_STATUS_OPTIONS, SCHEDULED_OPTIONS } from "./constants";
import { SERVICE_TYPE_OPTIONS } from "./service-types";

const currency = z.coerce.number().min(0).max(999999999);
const optionalText = z.string().trim().max(5000).optional().or(z.literal(""));
// Options configurable in Ajustes are validated by length only; the values come from admin-managed lists.
const optionalOption = z.string().trim().max(40).optional().or(z.literal(""));
// Responsáveis são opcionais (pode não estar decidido no momento do registro),
// mas quando preenchidos precisam vir da equipe cadastrada (validação de pertencimento nas actions).
const optionalResponsible = z.string().trim().max(120).optional().or(z.literal(""));

export const financeEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  patientName: optionalText,
  treatment: optionalText,
  serviceType: z.enum(SERVICE_TYPE_OPTIONS).optional().or(z.literal("")),
  specialty: optionalResponsible,
  total: z.coerce.number().min(0.01).max(999999999),
  professional: optionalResponsible,
  closer: optionalResponsible,
  observations: optionalText,
  refundAmount: z.coerce.number().min(0).max(999999999).optional().default(0)
});

export const messageEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: optionalText,
  contact: optionalText,
  type: optionalOption,
  channel: optionalOption,
  scheduledBy: optionalResponsible,
  professional: optionalResponsible,
  reason: optionalText,
  scheduled: z.enum(SCHEDULED_OPTIONS).optional().or(z.literal("")),
  attended: z.enum(ATTENDED_OPTIONS).optional().or(z.literal("")),
  approach: z.enum(APPROACH_OPTIONS).optional().or(z.literal("")),
  discardStatus: z.enum(DISCARD_STATUS_OPTIONS).optional().or(z.literal("")),
  discardReason: optionalOption,
  discardReasonOther: optionalText,
  bookedTreatment: z.enum(SCHEDULED_OPTIONS).optional().or(z.literal("")),
  status: z.enum(MESSAGE_STATUS_OPTIONS).optional().or(z.literal("")),
  observations: optionalText
});

export const studentSchema = z.object({
  name: z.string().trim().min(2).max(160),
  clinicName: optionalText,
  phone: optionalText,
  active: z.coerce.boolean().default(true)
});

export function financePaymentSum(data: {
  cash?: number | null;
  pix?: number | null;
  card?: number | null;
  transfer?: number | null;
}) {
  return Number(data.cash || 0) + Number(data.pix || 0) + Number(data.card || 0) + Number(data.transfer || 0);
}

/**
 * Entries with structured payments compare total vs the forms' sum; legacy
 * entries (pre-payment model) fall back to the old per-method columns.
 */
export function hasFinanceMismatch(data: {
  total?: unknown;
  cash?: unknown;
  pix?: unknown;
  card?: unknown;
  transfer?: unknown;
  payments?: Prisma.JsonValue | null;
}) {
  const total = toNumber(data.total as never);
  const stored = readStoredPayments(data.payments ?? null);
  if (stored) {
    return Math.abs(total - paymentsSum(stored)) > 0.009;
  }
  const paymentSum = toNumber(data.cash as never) + toNumber(data.pix as never) + toNumber(data.card as never) + toNumber(data.transfer as never);
  return Math.abs(total - paymentSum) > 0.009;
}
