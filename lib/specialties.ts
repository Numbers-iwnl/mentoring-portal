import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const SPECIALTIES_PREFIX = "specialties:";
export const MAX_SPECIALTIES = 60;
export const MAX_SPECIALTY_NAME_LENGTH = 80;

function specialtiesKey(studentId: string) {
  return `${SPECIALTIES_PREFIX}${studentId}`;
}

export function sanitizeSpecialtyName(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SPECIALTY_NAME_LENGTH);
}

export function sanitizeSpecialtyList(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const name = sanitizeSpecialtyName(value);
    if (!name) continue;
    const dedupeKey = name.toLocaleLowerCase("pt-BR");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(name);
    if (result.length >= MAX_SPECIALTIES) break;
  }
  return result;
}

export async function getSpecialties(studentId: string): Promise<string[]> {
  const stored = await prisma.appSetting.findUnique({
    where: { key: specialtiesKey(studentId) },
    select: { value: true }
  });
  if (!stored || typeof stored.value !== "object" || Array.isArray(stored.value) || stored.value === null) return [];
  const raw = (stored.value as Record<string, unknown>).specialties;
  if (!Array.isArray(raw)) return [];
  return sanitizeSpecialtyList(raw);
}

export async function saveSpecialties(studentId: string, names: unknown[]) {
  const specialties = sanitizeSpecialtyList(names);
  const value: Prisma.InputJsonValue = { version: 1, specialties };
  await prisma.appSetting.upsert({
    where: { key: specialtiesKey(studentId) },
    update: { value },
    create: { key: specialtiesKey(studentId), value }
  });
  return specialties;
}

export async function deleteSpecialties(studentId: string) {
  await prisma.appSetting.deleteMany({ where: { key: specialtiesKey(studentId) } });
}
