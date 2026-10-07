import { Download, Search } from "lucide-react";
import { AreaSwitcher } from "@/components/student/area-switcher";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClearFiltersLink } from "@/components/ui/clear-filters-link";
import { Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { requireStaffSection } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { pageSkipTake, parsePage, splitPage } from "@/lib/pagination";
import { dateRangeQuery, effectiveRange, effectiveRangePhrase, parseDateRange, parsePeriod, periodQuery, withParams } from "@/lib/period";
import { getStudentUnits, selectStudentUnit } from "@/lib/student-units";

export default async function HistoryPage({
  searchParams
}: {
  searchParams?: {
    area?: string;
    month?: string;
    year?: string;
    from?: string;
    to?: string;
    financePage?: string;
    messagesPage?: string;
    q?: string;
  };
}) {
  const { user, studentId } = await requireStaffSection("history");
  const isStaff = user.role === "STAFF";
  const units = studentId ? await getStudentUnits(studentId) : [];
  // Sem "area" na URL (e mais de uma unidade), mostra tudo consolidado — mesmo padrão da Visão
  // geral (ver app/app/page.tsx). Com uma única unidade não faz sentido oferecer "Tudo".
  const activeUnit = units.length === 1 ? units[0] : searchParams?.area ? selectStudentUnit(units, searchParams.area) : null;
  const period = parsePeriod(searchParams);
  const dateRange = parseDateRange(searchParams);
  const range = effectiveRange(period, dateRange);
  const financePage = parsePage({ page: searchParams?.financePage });
  const messagesPage = parsePage({ page: searchParams?.messagesPage });
  const query = (searchParams?.q ?? "").trim().slice(0, 80);

  const baseWhere = {
    studentId: studentId ?? "",
    ...(activeUnit ? { unitId: activeUnit.id } : {}),
    date: { gte: range.start, lte: range.end }
  };

  const [rawFinanceEntries, rawMessageEntries] = await Promise.all([
    prisma.financeEntry.findMany({
      where: {
        ...baseWhere,
        ...(query
          ? { OR: [{ patientName: { contains: query } }, { treatment: { contains: query } }, { serviceType: { contains: query } }] }
          : {})
      },
      orderBy: { date: "desc" },
      ...pageSkipTake(financePage)
    }),
    prisma.messageEntry.findMany({
      where: {
        ...baseWhere,
        ...(query ? { OR: [{ name: { contains: query } }, { contact: { contains: query } }] } : {})
      },
      orderBy: { date: "desc" },
      ...pageSkipTake(messagesPage)
    })
  ]);
  const { rows: financeEntries, hasNext: financeHasNext } = splitPage(rawFinanceEntries);
  const { rows: messageEntries, hasNext: messagesHasNext } = splitPage(rawMessageEntries);

  const exportParams = { unitId: activeUnit?.id, ...periodQuery(period), ...dateRangeQuery(dateRange) };
  const filterCarry = { area: activeUnit?.id, q: query || undefined, ...periodQuery(period), ...dateRangeQuery(dateRange) };

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Histórico</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Registros {effectiveRangePhrase(period, dateRange)}</h1>
        </div>
        <AreaSwitcher units={units} activeUnitId={activeUnit?.id} basePath="/app/history" carryParams={periodQuery(period)} allowAll />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSwitcher period={period} basePath="/app/history" carryParams={{ area: activeUnit?.id, q: query || undefined }} />
          <form className="flex flex-wrap items-center gap-2" action="/app/history">
            {activeUnit ? <input type="hidden" name="area" value={activeUnit.id} /> : null}
            {period.kind === "month" ? <input type="hidden" name="month" value={period.key} /> : null}
            {periodQuery(period).year ? <input type="hidden" name="year" value={periodQuery(period).year} /> : null}
            <Input name="q" defaultValue={query} placeholder="Buscar registros..." className="h-9 w-52 text-sm" />
            <Input name="from" type="date" defaultValue={dateRange?.from ?? ""} aria-label="De" className="h-9 w-[9.5rem] text-sm" />
            <Input name="to" type="date" defaultValue={dateRange?.to ?? ""} aria-label="Até" className="h-9 w-[9.5rem] text-sm" />
            <Button type="submit" variant="dark" className="h-9 px-4 text-xs">
              <Search size={14} />
              Buscar
            </Button>
          </form>
          <ClearFiltersLink
            show={Boolean(query || dateRange)}
            href={withParams("/app/history", { area: activeUnit?.id, ...periodQuery(period) })}
          />
        </div>
        {isStaff ? null : (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={withParams("/api/exports/finance", { format: "xlsx", ...exportParams })} variant="secondary" className="h-9 px-3 text-xs">
              <Download size={14} />
              Exportar vendas (.xlsx)
            </ButtonLink>
            <ButtonLink href={withParams("/api/exports/messages", { format: "xlsx", ...exportParams })} variant="secondary" className="h-9 px-3 text-xs">
              <Download size={14} />
              Exportar mensagens (.xlsx)
            </ButtonLink>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="data-table min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {financeEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                    <td>{entry.patientName ?? "-"}</td>
                    <td className="text-right font-semibold tabular-nums">{formatCurrency(entry.total)}</td>
                  </tr>
                ))}
                {!financeEntries.length ? (
                  <tr>
                    <td className="py-4 text-graphite-700/65" colSpan={3}>
                      Nenhuma venda no período.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <Pagination
              page={financePage}
              count={financeEntries.length}
              hasNext={financeHasNext}
              basePath="/app/history"
              paramName="financePage"
              carryParams={filterCarry}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mensagens</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="data-table min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Nome</th>
                  <th>Agendamento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {messageEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                    <td>{entry.name ?? "-"}</td>
                    <td>{entry.scheduled == null ? "-" : entry.scheduled ? "Agendou" : "Não agendou"}</td>
                    <td>{entry.status ?? "-"}</td>
                  </tr>
                ))}
                {!messageEntries.length ? (
                  <tr>
                    <td className="py-4 text-graphite-700/65" colSpan={4}>
                      Nenhuma mensagem no período.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <Pagination
              page={messagesPage}
              count={messageEntries.length}
              hasNext={messagesHasNext}
              basePath="/app/history"
              paramName="messagesPage"
              carryParams={filterCarry}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
