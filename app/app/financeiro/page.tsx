import { FinanceEntryForm, FinanceEntryRow, type FinanceEntryPlain } from "@/components/forms/finance-entry-form";
import { ServiceTypeCell } from "@/components/ui/service-type-cell";
import { AreaSwitcher } from "@/components/student/area-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterBar } from "@/components/filters/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { FINANCE_SORT, getFinanceFilterDefs } from "@/lib/finance-filters";
import { requireStaffSection } from "@/lib/guards";
import { parseFilters, parseSort } from "@/lib/list-filters";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@/lib/format";
import { pageSkipTake, parsePage, splitPage } from "@/lib/pagination";
import { paymentsSummary, readStoredPayments } from "@/lib/payments";
import { dateRangeQuery, effectiveRange, effectiveRangePhrase, parseDateRange, parsePeriod, periodQuery, withParams } from "@/lib/period";
import { getPortalOptions } from "@/lib/portal-options";
import { getProfessionals } from "@/lib/professionals";
import { getSpecialties } from "@/lib/specialties";
import { getStudentUnits, selectStudentUnit } from "@/lib/student-units";
import { hasFinanceMismatch } from "@/lib/validation";
import { createFinanceEntry, deleteFinanceEntry, updateFinanceEntry } from "./actions";
import { Toast } from "@/components/ui/toast";

const LIST_PAGE_SIZE = 25;

const ERROR_MESSAGES: Record<string, string> = {
  pagamento: "Confira as formas de pagamento: preencha tipo, valor e data do primeiro recebimento (máximo 2 formas).",
  pagamentoTotal: "A soma das formas de pagamento precisa ser igual ao valor total da venda.",
  responsaveis: "Os responsáveis são opcionais, mas se preenchidos precisam vir da equipe cadastrada na aba Equipe.",
  especialidade: "A especialidade é opcional, mas se preenchida precisa vir da lista cadastrada na aba Equipe.",
  campos: "Confira os campos da venda: data e valor total são obrigatórios.",
  tipo: "Escolha o tipo de atendimento da venda (Fisioterapia, Pilates, Recovery ou Outros).",
  estorno: "O valor estornado não pode ser maior que o valor total da venda."
};

export default async function FinanceiroPage({
  searchParams
}: {
  searchParams?: Record<string, string | undefined>;
}) {
  const { user, studentId } = await requireStaffSection("financeiro");
  const isStaff = user.role === "STAFF";
  const units = studentId ? await getStudentUnits(studentId) : [];
  const activeUnit = selectStudentUnit(units, searchParams?.area);
  const period = parsePeriod(searchParams);
  const dateRange = parseDateRange(searchParams);
  const range = effectiveRange(period, dateRange);
  const page = parsePage(searchParams);
  const query = (searchParams?.q ?? "").trim().slice(0, 80);
  const errorMessage = searchParams?.error ? ERROR_MESSAGES[searchParams.error] : undefined;
  // Opções dos filtros só com as vendas desta clínica — nunca de outro mentorado.
  const filterDefs = await getFinanceFilterDefs({ studentId: studentId ?? "" });
  const filters = parseFilters(filterDefs, searchParams);
  const sort = parseSort(FINANCE_SORT, searchParams);
  // Busca + filtros + ordem + datas: carregados por período, paginação e pela volta depois de salvar.
  const filterParams = { q: query || undefined, ...filters.params, ordem: sort.param, ...dateRangeQuery(dateRange) };

  const [rawEntries, professionals, specialties, installmentOptions, student] = await Promise.all([
    prisma.financeEntry.findMany({
      where: {
        studentId: studentId ?? "",
        ...(activeUnit ? { unitId: activeUnit.id } : {}),
        date: { gte: range.start, lte: range.end },
        AND: [
          query
            ? {
                OR: [
                  { patientName: { contains: query } },
                  { treatment: { contains: query } },
                  { serviceType: { contains: query } },
                  { professional: { contains: query } },
                  { closer: { contains: query } }
                ]
              }
            : {},
          ...filters.where
        ]
      },
      orderBy: sort.orderBy,
      ...pageSkipTake(page, LIST_PAGE_SIZE)
    }),
    studentId ? getProfessionals(studentId) : Promise.resolve([]),
    studentId ? getSpecialties(studentId) : Promise.resolve([]),
    getPortalOptions("installments"),
    studentId ? prisma.student.findUnique({ where: { id: studentId }, select: { paymentChannelEnabled: true } }) : Promise.resolve(null)
  ]);
  const { rows: entries, hasNext } = splitPage(rawEntries, LIST_PAGE_SIZE);
  const paymentChannelEnabled = student?.paymentChannelEnabled ?? false;
  const returnQuery = withParams("", {
    area: activeUnit?.id,
    ...filterParams,
    page: page > 1 ? String(page) : undefined,
    ...periodQuery(period)
  });

  const plainEntries: Array<FinanceEntryPlain & { mismatch: boolean; displayDate: string }> = entries.map((entry) => ({
    id: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    displayDate: entry.date.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
    patientName: entry.patientName ?? "",
    treatment: entry.treatment ?? "",
    serviceType: entry.serviceType ?? "",
    specialty: entry.specialty ?? "",
    total: toNumber(entry.total),
    payments: readStoredPayments(entry.payments),
    professional: entry.professional ?? "",
    closer: entry.closer ?? "",
    observations: entry.observations ?? "",
    refundAmount: toNumber(entry.refundAmount),
    refundedAtDisplay: entry.refundedAt ? entry.refundedAt.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
    mismatch: hasFinanceMismatch(entry)
  }));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Vendas</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Nova venda</h1>
        </div>
        <AreaSwitcher units={units} activeUnitId={activeUnit?.id} basePath="/app/financeiro" carryParams={periodQuery(period)} />
      </header>
      {searchParams?.saved ? (
        <Toast variant="success">
          Venda registrada com sucesso.
        </Toast>
      ) : null}
      {errorMessage ? (
        <Toast variant="error">{errorMessage}</Toast>
      ) : null}
      <Card>
        <CardContent>
          <FinanceEntryForm
            action={createFinanceEntry}
            unitId={activeUnit?.id}
            professionals={professionals}
            specialties={specialties}
            installmentOptions={installmentOptions}
            paymentChannelEnabled={paymentChannelEnabled}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Vendas {effectiveRangePhrase(period, dateRange)}</CardTitle>
          <PeriodSwitcher
            period={period}
            basePath="/app/financeiro"
            carryParams={{ area: activeUnit?.id, q: query || undefined, ...filters.params, ordem: sort.param }}
          />
          <FilterBar
            action="/app/financeiro"
            hidden={{ area: activeUnit?.id, ...periodQuery(period) }}
            carry={{ area: activeUnit?.id, ...periodQuery(period), ...filterParams }}
            query={query}
            searchPlaceholder="Buscar paciente, descrição, equipe..."
            defs={filterDefs}
            filters={filters}
            sort={FINANCE_SORT}
            sortValue={sort.value}
            sortChip={sort.chip}
            dateRange={dateRange}
            clearHref={withParams("/app/financeiro", { area: activeUnit?.id, ...periodQuery(period) })}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table min-w-[850px] text-left text-[13px]">
            <thead>
              <tr>
                <th className="py-2">Data</th>
                <th>Paciente</th>
                <th>Tipo de atendimento</th>
                <th>Forma de pagamento</th>
                <th className="text-right">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plainEntries.map((entry) => (
                <FinanceEntryRow
                  key={entry.id}
                  entry={entry}
                  unitId={activeUnit?.id}
                  updateAction={updateFinanceEntry}
                  deleteAction={deleteFinanceEntry}
                  professionals={professionals}
                  specialties={specialties}
                  installmentOptions={installmentOptions}
                  paymentChannelEnabled={paymentChannelEnabled}
                  canDelete={!isStaff}
                  canRefund={!isStaff}
                  returnQuery={returnQuery}
                >
                  <td className="py-3">{entry.displayDate}</td>
                  <td>{entry.patientName || "-"}</td>
                  <ServiceTypeCell serviceType={entry.serviceType} treatment={entry.treatment} />
                  <td>{entry.payments ? paymentsSummary(entry.payments) : "-"}</td>
                  <td className="text-right font-semibold tabular-nums">{formatCurrency(entry.total)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1">
                      {entry.mismatch ? <Badge>Conferir</Badge> : <Badge variant="ok">OK</Badge>}
                      {entry.refundAmount > 0 ? <Badge variant="danger">Estornado {formatCurrency(entry.refundAmount)}</Badge> : null}
                    </div>
                  </td>
                </FinanceEntryRow>
              ))}
              {!plainEntries.length ? (
                <tr>
                  <td className="py-4 text-graphite-700/65" colSpan={6}>
                    {Object.values(filterParams).some(Boolean) ? "Nenhuma venda encontrada para esses filtros neste período." : "Nenhuma venda registrada neste período."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <Pagination
            page={page}
            count={plainEntries.length}
            hasNext={hasNext}
            basePath="/app/financeiro"
            carryParams={{ area: activeUnit?.id, ...filterParams, ...periodQuery(period) }}
            pageSize={LIST_PAGE_SIZE}
          />
        </CardContent>
      </Card>
    </div>
  );
}
