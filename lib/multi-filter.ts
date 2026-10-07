/**
 * Filtros de múltipla escolha viajam na URL como UM parâmetro, com os valores separados por "|"
 * (ex.: ?origem=Instagram|Whatsapp). Assim continuam funcionando links antigos com um valor só e
 * o withParams/paginação/período carregam o filtro sem mudança.
 */
export const MULTI_SEPARATOR = "|";

/** Lê o parâmetro (aceita também a forma repetida ?x=a&x=b) e mantém só valores permitidos, sem repetir. */
export function parseMultiParam<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T[] {
  if (!value) return [];
  const raw = (Array.isArray(value) ? value : [value]).flatMap((item) => item.split(MULTI_SEPARATOR));
  const picked = new Set<T>();
  for (const item of raw) {
    const trimmed = item.trim();
    if ((allowed as readonly string[]).includes(trimmed)) picked.add(trimmed as T);
  }
  // Mantém a ordem das opções, para a URL ficar estável.
  return allowed.filter((option) => picked.has(option));
}

export function joinMultiParam(values: readonly string[]) {
  return values.length ? values.join(MULTI_SEPARATOR) : undefined;
}
