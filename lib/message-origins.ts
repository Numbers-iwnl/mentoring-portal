import type { Prisma } from "@prisma/client";
import { parseMultiParam } from "./multi-filter";
import { getPortalOptions } from "./portal-options";
import { prisma } from "./prisma";

/** Valor do filtro para contatos com a origem em branco. */
export const NO_ORIGIN = "__sem_origem__";

/**
 * Opções do filtro de Origem: a lista configurada em Ajustes + todo valor que já aparece nos
 * contatos (planilhas importadas e origens antigas trazem valores fora da lista atual).
 * Com `studentId`, só considera os contatos daquele mentorado — nunca expõe origens de outra clínica.
 */
export async function getOriginOptions(studentId?: string) {
  const [configured, used] = await Promise.all([
    getPortalOptions("channels"),
    prisma.messageEntry.findMany({
      // `!== undefined` de propósito: um id vazio não pode virar "todos os mentorados".
      where: { channel: { not: null }, ...(studentId !== undefined ? { studentId } : {}) },
      distinct: ["channel"],
      select: { channel: true }
    })
  ]);
  const values = new Set(configured);
  for (const row of used) {
    const value = row.channel?.trim();
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Valida o parâmetro `origem` da URL (uma ou várias origens, separadas por "|") contra as opções disponíveis. */
export function parseOrigins(value: string | string[] | undefined, options: string[]) {
  return parseMultiParam(value, [...options, NO_ORIGIN]);
}

/** Várias origens = contatos de qualquer uma delas. */
export function originWhere(origins: readonly string[]): Prisma.MessageEntryWhereInput {
  if (!origins.length) return {};
  const named = origins.filter((origin) => origin !== NO_ORIGIN);
  const conditions: Prisma.MessageEntryWhereInput[] = [];
  if (named.length) conditions.push({ channel: { in: named } });
  if (origins.includes(NO_ORIGIN)) conditions.push({ channel: null }, { channel: "" });
  return { OR: conditions };
}

/** Opções prontas para o filtro de múltipla escolha, com "Sem origem" no fim. */
export function originFilterOptions(options: string[]) {
  return [...options.map((value) => ({ value, label: value })), { value: NO_ORIGIN, label: "Sem origem" }];
}
