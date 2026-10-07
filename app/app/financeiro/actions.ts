"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EntrySource } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { dateFromInput } from "@/lib/dates";
import { requireStudentAccess } from "@/lib/guards";
import {
  legacyColumnsFromPayments,
  paymentsMatchTotal,
  serializePayments,
  validatePayments,
  type PaymentForm
} from "@/lib/payments";
import { withParams } from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { getProfessionals } from "@/lib/professionals";
import { getSpecialties } from "@/lib/specialties";
import { requireSubmittedStudentUnit } from "@/lib/student-units";
import { financeEntrySchema } from "@/lib/validation";

/** Redireciona de volta preservando página/busca/período (returnQuery), com params extras por cima. */
function backToReturnQuery(formData: FormData, extra: Record<string, string | undefined>): never {
  const params = new URLSearchParams(String(formData.get("returnQuery") || ""));
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  redirect(query ? `/app/financeiro?${query}` : "/app/financeiro");
}

function backTo(formData: FormData, unitId: string | null | undefined, error: string): never {
  backToReturnQuery(formData, { area: unitId ?? undefined, error });
}

/** Parses/validates the sale payload shared by create and update. */
async function parseSalePayload(studentId: string, unitId: string, formData: FormData) {
  const parsedFields = financeEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsedFields.success) {
    const flat = parsedFields.error.flatten().fieldErrors;
    if (flat.professional || flat.closer) backTo(formData, unitId, "responsaveis");
    if (flat.specialty) backTo(formData, unitId, "especialidade");
    if (flat.serviceType) backTo(formData, unitId, "tipo");
    backTo(formData, unitId, "campos");
  }
  const fields = parsedFields.data;

  let rawPayments: unknown;
  try {
    rawPayments = JSON.parse(String(formData.get("payments") || "[]"));
  } catch {
    backTo(formData, unitId, "pagamento");
  }
  const validated = validatePayments(rawPayments);
  if ("error" in validated) backTo(formData, unitId, "pagamento");
  const payments: PaymentForm[] = validated.payments;
  if (!paymentsMatchTotal(payments, fields.total)) backTo(formData, unitId, "pagamentoTotal");
  if (fields.refundAmount > fields.total) backTo(formData, unitId, "estorno");

  // Responsáveis e especialidade são opcionais, mas se preenchidos devem vir das listas cadastradas (sem digitação livre).
  const [team, specialties] = await Promise.all([getProfessionals(studentId), getSpecialties(studentId)]);
  if (fields.professional && !team.includes(fields.professional)) backTo(formData, unitId, "responsaveis");
  if (fields.closer && !team.includes(fields.closer)) backTo(formData, unitId, "responsaveis");
  if (fields.specialty && !specialties.includes(fields.specialty)) backTo(formData, unitId, "especialidade");

  const legacy = legacyColumnsFromPayments(payments);
  return { fields, payments, legacy };
}

export async function createFinanceEntry(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");
  const unit = await requireSubmittedStudentUnit(studentId, formData, "/app/financeiro");
  const { fields, payments, legacy } = await parseSalePayload(studentId, unit.id, formData);
  // Obrigatório só em venda nova: vendas antigas (sem categoria) continuam editáveis sem escolher.
  if (!fields.serviceType) backTo(formData, unit.id, "tipo");

  const entry = await prisma.financeEntry.create({
    data: {
      studentId,
      unitId: unit.id,
      date: dateFromInput(fields.date),
      patientName: fields.patientName || null,
      treatment: fields.treatment || null,
      serviceType: fields.serviceType || null,
      specialty: fields.specialty || null,
      total: fields.total,
      cash: legacy.cash,
      pix: legacy.pix,
      card: legacy.card,
      transfer: legacy.transfer,
      installments: null,
      payments: serializePayments(payments),
      professional: fields.professional || null,
      closer: fields.closer || null,
      observations: fields.observations || null,
      refundAmount: fields.refundAmount,
      refundedAt: fields.refundAmount > 0 ? new Date() : null,
      source: EntrySource.MANUAL,
      createdById: user.id
    }
  });

  await writeAudit({
    userId: user.id,
    studentId,
    action: "finance.create",
    entity: "FinanceEntry",
    entityId: entry.id,
    metadata: { unitId: unit.id, forms: payments.length }
  });

  revalidatePath("/app");
  revalidatePath("/app/financeiro");
  redirect(withParams("/app/financeiro", { area: unit.id, saved: "1" }));
}

export async function updateFinanceEntry(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");

  const entryId = String(formData.get("entryId") || "");
  const existing = await prisma.financeEntry.findFirst({
    where: { id: entryId, studentId },
    select: { id: true, refundAmount: true, refundedAt: true }
  });
  if (!existing) redirect("/app/financeiro");

  const unit = await requireSubmittedStudentUnit(studentId, formData, "/app/financeiro");
  const { fields, payments, legacy } = await parseSalePayload(studentId, unit.id, formData);

  const existingRefund = Number(existing.refundAmount);
  // Estorno é uma ação restrita ao mentorado (como excluir) — funcionário não altera esse campo,
  // mesmo que consiga montar o restante do formulário. O modal já esconde essa seção pra ele.
  if (user.role === "STAFF" && fields.refundAmount !== existingRefund) {
    backTo(formData, unit.id, "estorno");
  }
  // refundedAt marca quando o estorno foi registrado (não a data da venda) — só muda quando o
  // valor sai de zero pra maior que zero, ou volta pra zero (estorno removido/corrigido). Ajustar
  // o valor de um estorno já existente (sem passar por zero) mantém a data original.
  const refundedAt =
    fields.refundAmount > 0 ? (existingRefund > 0 ? existing.refundedAt : new Date()) : null;

  const entry = await prisma.financeEntry.update({
    where: { id: existing.id },
    data: {
      unitId: unit.id,
      date: dateFromInput(fields.date),
      patientName: fields.patientName || null,
      treatment: fields.treatment || null,
      serviceType: fields.serviceType || null,
      specialty: fields.specialty || null,
      total: fields.total,
      cash: legacy.cash,
      pix: legacy.pix,
      card: legacy.card,
      transfer: legacy.transfer,
      installments: null,
      payments: serializePayments(payments),
      professional: fields.professional || null,
      closer: fields.closer || null,
      observations: fields.observations || null,
      refundAmount: fields.refundAmount,
      refundedAt
    }
  });

  await writeAudit({
    userId: user.id,
    studentId,
    action: "finance.update",
    entity: "FinanceEntry",
    entityId: entry.id,
    metadata: { unitId: unit.id, forms: payments.length }
  });

  revalidatePath("/app");
  revalidatePath("/app/financeiro");
  backToReturnQuery(formData, { area: unit.id, saved: "1" });
}

export async function deleteFinanceEntry(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");
  if (user.role === "STAFF") redirect("/app/financeiro");

  const entryId = String(formData.get("entryId") || "");
  const existing = await prisma.financeEntry.findFirst({ where: { id: entryId, studentId }, select: { id: true, unitId: true } });
  if (!existing) redirect("/app/financeiro");

  await prisma.financeEntry.delete({ where: { id: existing.id } });

  await writeAudit({
    userId: user.id,
    studentId,
    action: "finance.delete",
    entity: "FinanceEntry",
    entityId: existing.id,
    metadata: { unitId: existing.unitId }
  });

  revalidatePath("/app");
  revalidatePath("/app/financeiro");
  backToReturnQuery(formData, { area: existing.unitId ?? undefined });
}
