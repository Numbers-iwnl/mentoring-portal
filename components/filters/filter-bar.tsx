import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { FilterDisclosure } from "@/components/filters/filter-disclosure";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { dateRangeChip, type FilterChip, type FilterDef, type ParsedFilters, type SortDef } from "@/lib/list-filters";
import type { DateRange } from "@/lib/period";
import { withParams } from "@/lib/period";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <span className="text-xs font-semibold text-graphite-800">{label}</span>
      {children}
    </div>
  );
}

const fieldClass = "h-10 text-sm";

/** Select com a mesma seta dos filtros de múltipla escolha (a seta nativa varia por navegador). */
function FilterSelect(props: React.ComponentProps<typeof Select>) {
  return (
    <div className="relative">
      <Select {...props} className={`${fieldClass} appearance-none pr-9`} />
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-graphite-700/60" aria-hidden="true" />
    </div>
  );
}

/**
 * Barra de busca + painel "Filtros" + chips dos filtros ativos, igual em todas as listas.
 * `hidden` = parâmetros que só acompanham o formulário (área ativa, mês/ano);
 * `carry` = todos os parâmetros atuais (para os links dos chips removerem só o próprio filtro).
 */
export function FilterBar<W, O>({
  action,
  hidden,
  carry,
  query,
  searchPlaceholder,
  defs,
  filters,
  sort,
  sortValue,
  sortChip,
  dateRange,
  clearHref
}: {
  action: string;
  hidden: Record<string, string | undefined>;
  carry: Record<string, string | undefined>;
  query: string;
  searchPlaceholder: string;
  defs: FilterDef<W>[];
  filters: ParsedFilters<W>;
  sort: SortDef<O>;
  sortValue: string;
  sortChip?: FilterChip;
  dateRange: DateRange | null;
  clearHref: string;
}) {
  const dateChip = dateRangeChip(dateRange);
  const chips: FilterChip[] = [
    ...(query ? [{ label: `Busca: "${query}"`, keys: ["q"] }] : []),
    ...(dateChip ? [dateChip] : []),
    ...filters.chips,
    ...(sortChip ? [sortChip] : [])
  ];
  const activeCount = filters.count + (dateRange ? 1 : 0) + (sortChip ? 1 : 0);
  const removeHref = (keys: string[]) =>
    withParams(action, { ...carry, ...Object.fromEntries(keys.map((key) => [key, undefined])), page: undefined });

  const groups: string[] = [];
  for (const def of defs) if (!groups.includes(def.group)) groups.push(def.group);
  if (!groups.includes(sort.group)) groups.push(sort.group);

  return (
    <div className="grid w-full gap-3">
      <form className="grid gap-3" action={action}>
        {Object.entries(hidden).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
        <FilterDisclosure
          activeCount={activeCount}
          bar={<Input name="q" defaultValue={query} placeholder={searchPlaceholder} className="h-9 w-64 max-w-full text-sm" />}
          submit={
            <Button type="submit" variant="dark" className="h-9 px-4 text-xs">
              <Search size={14} />
              Buscar
            </Button>
          }
        >
          <div className="grid gap-5">
            <section className="grid gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-champagne-700">Período personalizado</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FilterField label="De">
                  <Input name="from" type="date" defaultValue={dateRange?.from ?? ""} className={fieldClass} />
                </FilterField>
                <FilterField label="Até">
                  <Input name="to" type="date" defaultValue={dateRange?.to ?? ""} className={fieldClass} />
                </FilterField>
              </div>
              <p className="text-xs text-graphite-700/65">Preencha as duas datas. Sem elas, vale o mês/ano escolhido no seletor de período.</p>
            </section>
            {groups.map((group) => (
              <section key={group} className="grid gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-champagne-700">{group}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {defs
                    .filter((def) => def.group === group)
                    .map((def) =>
                      def.kind === "range" ? (
                        <FilterField key={def.key} label={def.label}>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              name={def.minKey}
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              placeholder="Mín. R$"
                              aria-label={`${def.label} mínimo`}
                              defaultValue={filters.values[def.minKey]?.[0] ?? ""}
                              className={fieldClass}
                            />
                            <Input
                              name={def.maxKey}
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              placeholder="Máx. R$"
                              aria-label={`${def.label} máximo`}
                              defaultValue={filters.values[def.maxKey]?.[0] ?? ""}
                              className={fieldClass}
                            />
                          </div>
                        </FilterField>
                      ) : def.kind === "multi" ? (
                        <FilterField key={def.key} label={def.label}>
                          {def.options.length ? (
                            <MultiSelectFilter
                              plain
                              name={def.key}
                              label={def.label}
                              allLabel={def.allLabel}
                              options={def.options}
                              defaultValues={filters.values[def.key] ?? []}
                            />
                          ) : (
                            <p className="flex h-10 items-center text-xs text-graphite-700/60">Nenhum valor registrado ainda.</p>
                          )}
                        </FilterField>
                      ) : (
                        <FilterField key={def.key} label={def.label}>
                          <FilterSelect name={def.key} defaultValue={filters.values[def.key]?.[0] ?? ""} aria-label={def.label}>
                            <option value="">{def.allLabel}</option>
                            {def.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </FilterSelect>
                        </FilterField>
                      )
                    )}
                  {group === sort.group ? (
                    <FilterField label={sort.label}>
                      <FilterSelect name={sort.key} defaultValue={sortValue} aria-label={sort.label}>
                        {sort.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </FilterSelect>
                    </FilterField>
                  ) : null}
                </div>
              </section>
            ))}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[rgba(0,6,35,0.08)] pt-3">
              {chips.length ? (
                <Link
                  href={clearHref}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-graphite-700 transition hover:bg-champagne-50"
                >
                  <X size={14} />
                  Limpar todos os filtros
                </Link>
              ) : null}
              <Button type="submit" variant="dark" className="h-9 px-4 text-xs">
                Aplicar filtros
              </Button>
            </div>
          </div>
        </FilterDisclosure>
      </form>
      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Link
              key={chip.keys.join("-")}
              href={removeHref(chip.keys)}
              title="Remover este filtro"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-champagne-500/60 bg-champagne-50 px-3 py-1 text-xs font-semibold text-graphite-800 transition hover:border-graphite-950"
            >
              <span className="truncate">{chip.label}</span>
              <X size={12} className="shrink-0" aria-hidden="true" />
            </Link>
          ))}
          <Link href={clearHref} className="text-xs font-semibold text-graphite-700 underline-offset-2 hover:underline">
            Limpar filtros
          </Link>
        </div>
      ) : null}
    </div>
  );
}
