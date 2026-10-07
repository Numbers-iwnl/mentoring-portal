import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const PROFESSIONALS_PREFIX = "professionals:";
export const MAX_PROFESSIONALS = 60;
export const MAX_PROFESSIONAL_NAME_LENGTH = 80;

function professionalsKey(studentId: string) {
  return `${PROFESSIONALS_PREFIX}${studentId}`;
}

export function sanitizeProfessionalName(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROFESSIONAL_NAME_LENGTH);
}

export function sanitizeProfessionalList(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const name = sanitizeProfessionalName(value);
    if (!name) continue;
    const dedupeKey = name.toLocaleLowerCase("pt-BR");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(name);
    if (result.length >= MAX_PROFESSIONALS) break;
  }
  return result;
}

export async function getProfessionals(studentId: string): Promise<string[]> {
  const stored = await prisma.appSetting.findUnique({
    where: { key: professionalsKey(studentId) },
    select: { value: true }
  });
  if (!stored || typeof stored.value !== "object" || Array.isArray(stored.value) || stored.value === null) return [];
  const raw = (stored.value as Record<string, unknown>).professionals;
  if (!Array.isArray(raw)) return [];
  return sanitizeProfessionalList(raw);
}

export async function saveProfessionals(studentId: string, names: unknown[]) {
  const professionals = sanitizeProfessionalList(names);
  const value: Prisma.InputJsonValue = { version: 1, professionals };
  await prisma.appSetting.upsert({
    where: { key: professionalsKey(studentId) },
    update: { value },
    create: { key: professionalsKey(studentId), value }
  });
  return professionals;
}

export async function deleteProfessionals(studentId: string) {
  await prisma.appSetting.deleteMany({ where: { key: professionalsKey(studentId) } });
}
