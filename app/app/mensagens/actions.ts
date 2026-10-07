"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EntrySource } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { DISCARD_REASON_OTHER } from "@/lib/constants";
import { dateFromInput } from "@/lib/dates";
import { requireStudentAccess } from "@/lib/guards";
import { withParams } from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { getProfessionals } from "@/lib/professionals";
import { requireSubmittedStudentUnit } from "@/lib/student-units";
import { messageEntrySchema } from "@/lib/validation";

/** Redireciona de volta preservando página/busca/período (returnQuery), com params extras por cima. */
function backToReturnQuery(formData: FormData, extra: Record<string, string | undefined>): never {
  const params = new URLSearchParams(String(formData.get("returnQuery") || ""));
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  redirect(query ? `/app/mensagens?${query}` : "/app/mensagens");
}

function backTo(formData: FormData, unitId: string | null | undefined, error: string): never {
  backToReturnQuery(formData, { area: unitId ?? undefined, error });
}

/** Valida os campos e o pertencimento dos responsáveis à equipe cadastrada. */
async function parseMessagePayload(studentId: string, unitId: string, formData: FormData) {
  const parsed = messageEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    if (flat.scheduledBy || flat.professional) backTo(formData, unitId, "responsaveis");
    backTo(formData, unitId, "campos");
  }
  // Responsáveis são opcionais, mas se preenchidos devem vir da equipe cadastrada (sem digitação livre).
  const team = await getProfessionals(studentId);
  if (parsed.data.scheduledBy && !team.includes(parsed.data.scheduledBy)) backTo(formData, unitId, "responsaveis");
  if (parsed.data.professional && !team.includes(parsed.data.professional)) backTo(formData, unitId, "responsaveis");
  return parsed.data;
}

export async function createMessageEntry(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");
  const unit = await requireSubmittedStudentUnit(studentId, formData, "/app/mensagens");
  const parsed = await parseMessagePayload(studentId, unit.id, formData);
  const entry = await prisma.messageEntry.create({
    data: {
      studentId,
      unitId: unit.id,
      date: dateFromInput(parsed.date),
      name: parsed.name || null,
      contact: parsed.contact || null,
      type: parsed.type || null,
      channel: parsed.channel || null,
      scheduledBy: parsed.scheduledBy || null,
      professional: parsed.professional || null,
      reason: parsed.reason || null,
      scheduled: parsed.scheduled === "Sim" ? true : parsed.scheduled === "Não" ? false : null,
      attended: parsed.attended || null,
      approach: parsed.approach || null,
      discardStatus: parsed.discardStatus || null,
      discardReason: parsed.discardReason || null,
      discardReasonOther: parsed.discardReason === DISCARD_REASON_OTHER ? parsed.discardReasonOther || null : null,
      bookedTreatment: parsed.bookedTreatment === "Sim" ? true : parsed.bookedTreatment === "Não" ? false : null,
      status: parsed.status || null,
      observations: parsed.observations || null,
      source: EntrySource.MANUAL,
      createdById: user.id
    }
  });

  await writeAudit({
    userId: user.id,
    studentId,
    action: "message.create",
    entity: "MessageEntry",
    entityId: entry.id,
    metadata: { unitId: unit.id }
  });

  revalidatePath("/app");
  revalidatePath("/app/mensagens");
  redirect(withParams("/app/mensagens", { area: unit.id, saved: "1" }));
}

export async function updateMessageEntry(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");

  const entryId = String(formData.get("entryId") || "");
  const existing = await prisma.messageEntry.findFirst({ where: { id: entryId, studentId }, select: { id: true } });
  if (!existing) redirect("/app/mensagens");

  const unit = await requireSubmittedStudentUnit(studentId, formData, "/app/mensagens");
  const parsed = await parseMessagePayload(studentId, unit.id, formData);
  const entry = await prisma.messageEntry.update({
    where: { id: existing.id },
    data: {
      unitId: unit.id,
      date: dateFromInput(parsed.date),
      name: parsed.name || null,
      contact: parsed.contact || null,
      type: parsed.type || null,
      channel: parsed.channel || null,
      scheduledBy: parsed.scheduledBy || null,
      professional: parsed.professional || null,
      reason: parsed.reason || null,
      scheduled: parsed.scheduled === "Sim" ? true : parsed.scheduled === "Não" ? false : null,
      attended: parsed.attended || null,
      approach: parsed.approach || null,
      discardStatus: parsed.discardStatus || null,
      discardReason: parsed.discardReason || null,
      discardReasonOther: parsed.discardReason === DISCARD_REASON_OTHER ? parsed.discardReasonOther || null : null,
      bookedTreatment: parsed.bookedTreatment === "Sim" ? true : parsed.bookedTreatment === "Não" ? false : null,
      status: parsed.status || null,
      observations: parsed.observations || null
    }
  });

  await writeAudit({
    userId: user.id,
    studentId,
    action: "message.update",
    entity: "MessageEntry",
    entityId: entry.id,
    metadata: { unitId: unit.id }
  });

  revalidatePath("/app");
  revalidatePath("/app/mensagens");
  backToReturnQuery(formData, { area: unit.id, updated: "1" });
}

export async function deleteMessageEntry(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");
  if (user.role === "STAFF") redirect("/app/mensagens");

  const entryId = String(formData.get("entryId") || "");
  const existing = await prisma.messageEntry.findFirst({ where: { id: entryId, studentId }, select: { id: true, unitId: true } });
  if (!existing) redirect("/app/mensagens");

  await prisma.messageEntry.delete({ where: { id: existing.id } });

  await writeAudit({
    userId: user.id,
    studentId,
    action: "message.delete",
    entity: "MessageEntry",
    entityId: existing.id,
    metadata: { unitId: existing.unitId }
  });

  revalidatePath("/app");
  revalidatePath("/app/mensagens");
  backToReturnQuery(formData, { area: existing.unitId ?? undefined });
}
