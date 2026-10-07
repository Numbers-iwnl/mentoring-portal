import { Download } from "lucide-react";
import { FinanceDetailRow, type FinanceDetail } from "@/components/admin/finance-detail-row";
import { FilterBar } from "@/components/filters/filter-bar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { ServiceTypeCell } from "@/components/ui/service-type-cell";
import { TIME_ZONE } from "@/lib/constants";
import { FINANCE_SORT, getFinanceFilterDefs } from "@/lib/finance-filters";
import { requireAdmin } from "@/lib/guards";
import { parseFilters, parseSort } from "@/lib/list-filters";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@/lib/format";
import { pageSkipTake, parsePage, splitPage } from "@/lib/pagination";
import { readStoredPayments } from "@/lib/payments";
import { dateRangeQuery, effectiveRange, effectiveRangePhrase, parseDateRange, parsePeriod, periodQuery, withParams } from "@/lib/period";
import { studentUnitLabel } from "@/lib/student-units";
import { hasFinanceMismatch } from "@/lib/validation";

const dateTime = (value: Date) =>
  value.toLocaleString("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AdminFinancePage({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  await requireAdmin();
  const period = parsePeriod(searchParams);
  const dateRange = parseDateRange(searchParams);
  const range = effectiveRange(period, dateRange);
  const page = parsePage(searchParams);
  const query = (searchParams?.q ?? "").trim().slice(0, 80);
  const filterDefs = await getFinanceFilterDefs({ admin: true });
  const filters = parseFilters(filterDefs, searchParams);
  const sort = parseSort(FINANCE_SORT, searchParams);
  // Busca + filtros + ordem + datas: carregados por período e paginação.
  const filterParams = { q: query || undefined, ...filters.params, ordem: sort.param, ...dateRangeQuery(dateRange) };

  const rawEntries = await prisma.financeEntry.findMany({
    where: {
      date: { gte: range.start, lte: range.end },
      AND: [
        query
          ? {
              OR: [
                { patientName: { contains: query } },
                { treatment: { contains: query } },
                { serviceType: { contains: query } },
                { professional: { contains: query } },
                { closer: { contains: query } },
                { student: { name: { contains: query } } }
              ]
            }
          : {},
        ...filters.where
      ]
    },
    include: { student: true, unit: true, createdBy: { select: { name: true } } },
    orderBy: sort.orderBy,
    ...pageSkipTake(page)
  });
  const { rows: entries, hasNext } = splitPage(rawEntries);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Vendas</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Lançamentos de vendas</h1>
        </div>
        <ButtonLink href={withParams("/api/exports/finance", { format: "xlsx", ...periodQuery(period) })} variant="secondary">
          <Download size={16} />
          Exportar
        </ButtonLink>
      </header>
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Vendas {effectiveRangePhrase(period, dateRange)}</CardTitle>
          <PeriodSwitcher period={period} basePath="/admin/finance" carryParams={{ q: query || undefined, ...filters.params, ordem: sort.param }} />
          <FilterBar
            action="/admin/finance"
            hidden={periodQuery(period)}
            carry={{ ...periodQuery(period), ...filterParams }}
            query={query}
            searchPlaceholder="Buscar paciente, mentorado, descrição..."
            defs={filterDefs}
            filters={filters}
            sort={FINANCE_SORT}
            sortValue={sort.value}
            sortChip={sort.chip}
            dateRange={dateRange}
            clearHref={withParams("/admin/finance", { ...periodQuery(period) })}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table min-w-[1000px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Data</th>
                <th>Mentorado</th>
                <th>Área</th>
                <th>Paciente</th>
                <th>Tipo de atendimento</th>
                <th className="text-right">Total</th>
                <th>Origem</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const mismatch = hasFinanceMismatch(entry);
                const displayDate = entry.date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
                const detail: FinanceDetail = {
                  date: displayDate,
                  student: entry.student.name,
                  area: studentUnitLabel(entry.unit),
                  patientName: entry.patientName ?? "",
                  serviceType: entry.serviceType ?? "",
                  description: entry.treatment ?? "",
                  specialty: entry.specialty ?? "",
                  total: toNumber(entry.total),
                  payments: readStoredPayments(entry.payments),
                  legacyPayments: [
                    { label: "Dinheiro", amount: toNumber(entry.cash) },
                    { label: "PIX", amount: toNumber(entry.pix) },
                    { label: "Cartão", amount: toNumber(entry.card) },
                    { label: "Transferência", amount: toNumber(entry.transfer) }
                  ].filter((payment) => payment.amount > 0),
                  professional: entry.professional ?? "",
                  closer: entry.closer ?? "",
                  observations: entry.observations ?? "",
                  refundAmount: toNumber(entry.refundAmount),
                  refundedAt: entry.refundedAt ? dateTime(entry.refundedAt) : "",
                  mismatch,
                  source: entry.source === "IMPORT" ? `Importado${entry.sourceSheet ? ` (planilha, aba “${entry.sourceSheet.trim()}”)` : ""}` : "Manual",
                  createdBy: entry.createdBy?.name ?? (entry.source === "IMPORT" ? "Importação de planilha" : ""),
                  createdAt: dateTime(entry.createdAt),
                  updatedAt: dateTime(entry.updatedAt)
                };
                return (
                  <FinanceDetailRow key={entry.id} detail={detail}>
                    <td className="py-3">{displayDate}</td>
                    <td>{entry.student.name}</td>
                    <td>{studentUnitLabel(entry.unit)}</td>
                    <td>{entry.patientName ?? "-"}</td>
                    <ServiceTypeCell serviceType={entry.serviceType} treatment={entry.treatment} />
                    <td className="text-right font-semibold tabular-nums">{formatCurrency(entry.total)}</td>
                    <td>{entry.source === "IMPORT" ? "Importado" : "Manual"}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        {mismatch ? <Badge>Conferir</Badge> : <Badge variant="ok">OK</Badge>}
                        {Number(entry.refundAmount) > 0 ? (
                          <Badge variant="danger">Estornado {formatCurrency(entry.refundAmount)}</Badge>
                        ) : null}
                      </div>
                    </td>
                  </FinanceDetailRow>
                );
              })}
              {!entries.length ? (
                <tr>
                  <td className="py-4 text-graphite-700/65" colSpan={8}>
                    Nenhuma venda no período{Object.values(filterParams).some(Boolean) ? " para esses filtros" : ""}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <Pagination
            page={page}
            count={entries.length}
            hasNext={hasNext}
            basePath="/admin/finance"
            carryParams={{ ...filterParams, ...periodQuery(period) }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
