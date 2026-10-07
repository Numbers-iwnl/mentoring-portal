import { joinMultiParam, parseMultiParam } from "./multi-filter";
import type { DateRange } from "./period";

/**
 * Painel "Filtros" das listas (Vendas e Mensagens, admin e mentorado/funcionário).
 * Cada página declara seus filtros (FilterDef); aqui ficam a leitura da URL, a condição do banco
 * e os "chips" de filtros ativos. Tudo vai na URL (GET), então links, período, paginação e a volta
 * depois de salvar um registro continuam carregando os filtros.
 */

export type FilterOption = { value: string; label: string };

type FilterBase = {
  /** Nome do parâmetro na URL. */
  key: string;
  label: string;
  /** Seção do painel em que o filtro aparece. */
  group: string;
};

export type ChoiceFilterDef<W> = FilterBase & {
  /** multi = pode marcar vários (valores separados por "|" na URL); single = um só. */
  kind: "multi" | "single";
  options: FilterOption[];
  /** Texto quando nada está escolhido, ex.: "Todos". */
  allLabel: string;
  where: (values: string[]) => W;
};

export type RangeFilterDef<W> = FilterBase & {
  kind: "range";
  minKey: string;
  maxKey: string;
  where: (min: number | undefined, max: number | undefined) => W;
};

export type FilterDef<W> = ChoiceFilterDef<W> | RangeFilterDef<W>;

export type SortDef<O> = {
  key: string;
  label: string;
  group: string;
  /** A primeira opção é a ordem padrão (não vira chip nem parâmetro). */
  options: Array<FilterOption & { orderBy: O }>;
};

export type FilterChip = { label: string; keys: string[] };

type SearchParams = Record<string, string | string[] | undefined> | undefined;

export type ParsedFilters<W> = {
  where: W[];
  /** Parâmetros dos filtros ativos, para carregar em links (período, paginação, retorno). */
  params: Record<string, string | undefined>;
  chips: FilterChip[];
  /** Valores escolhidos por chave (para preencher o painel). */
  values: Record<string, string[]>;
  /** Quantos filtros do painel estão ativos (conta também datas e ordem). */
  count: number;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Aceita "1500", "1500.5" e "1.500,50"; ignora vazio, negativo e lixo. */
export function parseAmount(value: string | string[] | undefined) {
  const raw = first(value)?.trim();
  if (!raw) return undefined;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 && amount <= 999_999_999 ? Math.round(amount * 100) / 100 : undefined;
}

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function parseFilters<W>(defs: FilterDef<W>[], searchParams: SearchParams): ParsedFilters<W> {
  const parsed: ParsedFilters<W> = { where: [], params: {}, chips: [], values: {}, count: 0 };
  for (const def of defs) {
    if (def.kind === "range") {
      let min = parseAmount(searchParams?.[def.minKey]);
      let max = parseAmount(searchParams?.[def.maxKey]);
      if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
      parsed.values[def.minKey] = min === undefined ? [] : [String(min)];
      parsed.values[def.maxKey] = max === undefined ? [] : [String(max)];
      if (min === undefined && max === undefined) continue;
      parsed.where.push(def.where(min, max));
      parsed.params[def.minKey] = min === undefined ? undefined : String(min);
      parsed.params[def.maxKey] = max === undefined ? undefined : String(max);
      const text =
        min !== undefined && max !== undefined ? `${brl(min)} a ${brl(max)}` : min !== undefined ? `a partir de ${brl(min)}` : `até ${brl(max!)}`;
      parsed.chips.push({ label: `${def.label}: ${text}`, keys: [def.minKey, def.maxKey] });
      parsed.count += 1;
      continue;
    }
    const picked = parseMultiParam(
      searchParams?.[def.key],
      def.options.map((option) => option.value)
    );
    const values = def.kind === "single" ? picked.slice(0, 1) : picked;
    parsed.values[def.key] = values;
    if (!values.length) continue;
    parsed.where.push(def.where(values));
    parsed.params[def.key] = joinMultiParam(values);
    const labels = values.map((value) => def.options.find((option) => option.value === value)?.label ?? value);
    parsed.chips.push({ label: `${def.label}: ${labels.join(", ")}`, keys: [def.key] });
    parsed.count += 1;
  }
  return parsed;
}

export function parseSort<O>(def: SortDef<O>, searchParams: SearchParams) {
  const requested = first(searchParams?.[def.key]);
  const option = def.options.find((item) => item.value === requested) ?? def.options[0];
  const isDefault = option === def.options[0];
  return {
    value: option.value,
    orderBy: option.orderBy,
    param: isDefault ? undefined : option.value,
    chip: isDefault ? undefined : ({ label: `${def.label}: ${option.label}`, keys: [def.key] } satisfies FilterChip)
  };
}

export function dateRangeChip(dateRange: DateRange | null): FilterChip | undefined {
  if (!dateRange) return undefined;
  const format = (value: string) => value.split("-").reverse().join("/");
  return { label: `Datas: ${format(dateRange.from)} a ${format(dateRange.to)}`, keys: ["from", "to"] };
}

/** Lista de opções a partir de valores de texto (ordenados, sem repetir, sem vazio). */
export function textOptions(...lists: Array<ReadonlyArray<string | null | undefined>>): FilterOption[] {
  const values = new Set<string>();
  for (const list of lists) {
    for (const item of list) {
      const value = item?.trim();
      if (value) values.add(value);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b, "pt-BR")).map((value) => ({ value, label: value }));
}
