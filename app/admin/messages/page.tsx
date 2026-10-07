import { Download } from "lucide-react";
import { FilterBar } from "@/components/filters/filter-bar";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { requireAdmin } from "@/lib/guards";
import { parseFilters, parseSort } from "@/lib/list-filters";
import { getMessageFilterDefs, MESSAGE_SORT } from "@/lib/message-filters";
import { pageSkipTake, parsePage, splitPage } from "@/lib/pagination";
import { dateRangeQuery, effectiveRange, effectiveRangePhrase, parseDateRange, parsePeriod, periodQuery, withParams } from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { studentUnitLabel } from "@/lib/student-units";

export default async function AdminMessagesPage({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  await requireAdmin();
  const period = parsePeriod(searchParams);
  const dateRange = parseDateRange(searchParams);
  const range = effectiveRange(period, dateRange);
  const page = parsePage(searchParams);
  const query = (searchParams?.q ?? "").trim().slice(0, 80);
  const filterDefs = await getMessageFilterDefs({ admin: true });
  const filters = parseFilters(filterDefs, searchParams);
  const sort = parseSort(MESSAGE_SORT, searchParams);
  // Busca + filtros + ordem + datas: carregados por período e paginação.
  const filterParams = { q: query || undefined, ...filters.params, ordem: sort.param, ...dateRangeQuery(dateRange) };

  const rawEntries = await prisma.messageEntry.findMany({
    where: {
      date: { gte: range.start, lte: range.end },
      AND: [
        query
          ? {
              OR: [
                { name: { contains: query } },
                { contact: { contains: query } },
                { student: { name: { contains: query } } }
              ]
            }
          : {},
        ...filters.where
      ]
    },
    include: { student: true, unit: true },
    orderBy: sort.orderBy,
    ...pageSkipTake(page)
  });
  const { rows: entries, hasNext } = splitPage(rawEntries);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Mensagens</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Captação e follow-up</h1>
        </div>
        <ButtonLink href={withParams("/api/exports/messages", { format: "xlsx", ...periodQuery(period) })} variant="secondary">
          <Download size={16} />
          Exportar
        </ButtonLink>
      </header>
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Contatos {effectiveRangePhrase(period, dateRange)}</CardTitle>
          <PeriodSwitcher period={period} basePath="/admin/messages" carryParams={{ q: query || undefined, ...filters.params, ordem: sort.param }} />
          <FilterBar
            action="/admin/messages"
            hidden={periodQuery(period)}
            carry={{ ...periodQuery(period), ...filterParams }}
            query={query}
            searchPlaceholder="Buscar nome, contato, mentorado..."
            defs={filterDefs}
            filters={filters}
            sort={MESSAGE_SORT}
            sortValue={sort.value}
            sortChip={sort.chip}
            dateRange={dateRange}
            clearHref={withParams("/admin/messages", { ...periodQuery(period) })}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table min-w-[1000px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Data</th>
                <th>Mentorado</th>
                <th>Área</th>
                <th>Nome</th>
                <th>Origem</th>
                <th>Agendou</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-3">{entry.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                  <td>{entry.student.name}</td>
                  <td>{studentUnitLabel(entry.unit)}</td>
                  <td>{entry.name ?? "-"}</td>
                  <td>{entry.channel ?? "-"}</td>
                  <td>{entry.scheduled == null ? "-" : entry.scheduled ? "Sim" : "Não"}</td>
                  <td>
                    {entry.status === "Pendente" ? (
                      <Badge>Pendente</Badge>
                    ) : entry.status === "Finalizado" ? (
                      <Badge variant="ok">Finalizado</Badge>
                    ) : (
                      entry.status ?? "-"
                    )}
                  </td>
                </tr>
              ))}
              {!entries.length ? (
                <tr>
                  <td className="py-4 text-graphite-700/65" colSpan={7}>
                    Nenhum contato no período{Object.values(filterParams).some(Boolean) ? " para esses filtros" : ""}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <Pagination
            page={page}
            count={entries.length}
            hasNext={hasNext}
            basePath="/admin/messages"
            carryParams={{ ...filterParams, ...periodQuery(period) }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
