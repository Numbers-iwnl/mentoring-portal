import type { Prisma } from "@prisma/client";
import { CHANNEL_OPTIONS, DISCARD_REASON_OPTIONS, INSTALLMENT_OPTIONS, MESSAGE_TYPE_OPTIONS } from "./constants";
import { prisma } from "./prisma";

/**
 * Editable option lists shown as dropdowns in the entry forms.
 * Stored in AppSetting as `portal-options:{kind}`; the hardcoded constants
 * remain the defaults until an admin customizes a list.
 *
 * Status ("Finalizado"/"Pendente") and Agendou ("Sim"/"Não") are intentionally
 * NOT editable: the dashboards compute pendências and conversão from them.
 */
export type PortalOptionKind = "installments" | "messageTypes" | "channels" | "discardReasons";

export const PORTAL_OPTION_DEFAULTS: Record<PortalOptionKind, readonly string[]> = {
  installments: INSTALLMENT_OPTIONS,
  messageTypes: MESSAGE_TYPE_OPTIONS,
  channels: CHANNEL_OPTIONS,
  discardReasons: DISCARD_REASON_OPTIONS
};

export const PORTAL_OPTION_LABELS: Record<PortalOptionKind, string> = {
  installments: "Parcelas",
  messageTypes: "Tipos de mensagem",
  channels: "Origens",
  discardReasons: "Motivos de descarte"
};

export const MAX_PORTAL_OPTIONS = 24;
export const MAX_PORTAL_OPTION_LENGTH = 40;

const PREFIX = "portal-options:";

function optionKey(kind: PortalOptionKind) {
  return `${PREFIX}${kind}`;
}

export function sanitizePortalOption(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PORTAL_OPTION_LENGTH);
}

export function sanitizePortalOptionList(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const option = sanitizePortalOption(value);
    if (!option) continue;
    const dedupeKey = option.toLocaleLowerCase("pt-BR");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(option);
    if (result.length >= MAX_PORTAL_OPTIONS) break;
  }
  return result;
}

function parseStored(kind: PortalOptionKind, value: Prisma.JsonValue | undefined): string[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>).options;
  if (!Array.isArray(raw)) return null;
  const parsed = sanitizePortalOptionList(raw);
  return parsed.length ? parsed : null;
}

export async function getPortalOptions(kind: PortalOptionKind): Promise<string[]> {
  const stored = await prisma.appSetting.findUnique({ where: { key: optionKey(kind) }, select: { value: true } });
  return parseStored(kind, stored?.value) ?? [...PORTAL_OPTION_DEFAULTS[kind]];
}

export async function getAllPortalOptions(): Promise<Record<PortalOptionKind, string[]>> {
  const kinds = Object.keys(PORTAL_OPTION_DEFAULTS) as PortalOptionKind[];
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: kinds.map(optionKey) } },
    select: { key: true, value: true }
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return Object.fromEntries(
    kinds.map((kind) => [kind, parseStored(kind, byKey.get(optionKey(kind))) ?? [...PORTAL_OPTION_DEFAULTS[kind]]])
  ) as Record<PortalOptionKind, string[]>;
}

export async function savePortalOptions(kind: PortalOptionKind, values: unknown[]) {
  const options = sanitizePortalOptionList(values);
  if (!options.length) {
    throw new Error("A lista precisa ter pelo menos uma opção.");
  }
  const value: Prisma.InputJsonValue = { version: 1, options };
  await prisma.appSetting.upsert({
    where: { key: optionKey(kind) },
    update: { value },
    create: { key: optionKey(kind), value }
  });
  return options;
}

export function isPortalOptionKind(value: unknown): value is PortalOptionKind {
  return value === "installments" || value === "messageTypes" || value === "channels" || value === "discardReasons";
}
