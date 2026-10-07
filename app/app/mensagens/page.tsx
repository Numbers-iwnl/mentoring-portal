import { MessageEntryForm, MessageEntryRow, type MessageEntryPlain } from "@/components/forms/message-entry-form";
import { AreaSwitcher } from "@/components/student/area-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterBar } from "@/components/filters/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { requireStaffSection } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { pageSkipTake, parsePage, splitPage } from "@/lib/pagination";
import { dateRangeQuery, effectiveRange, effectiveRangePhrase, parseDateRange, parsePeriod, periodQuery, withParams } from "@/lib/period";
import { parseFilters, parseSort } from "@/lib/list-filters";
import { getMessageFilterDefs, MESSAGE_SORT } from "@/lib/message-filters";
import { getPortalOptions } from "@/lib/portal-options";
import { getProfessionals } from "@/lib/professionals";
import { getStudentUnits, selectStudentUnit } from "@/lib/student-units";
import { createMessageEntry, deleteMessageEntry, updateMessageEntry } from "./actions";
import { Toast } from "@/components/ui/toast";
import { DISCARD_REASON_OTHER } from "@/lib/constants";

const LIST_PAGE_SIZE = 25;

/** "Contato descartado" / "Contato qualificado" -> "Descartado" / "Qualificado", pra caber na coluna. */
function shortDiscardStatus(value: string) {
  return value.replace(/^Contato\s+/i, "");
}

function discardReasonDisplay(entry: Pick<MessageEntryPlain, "discardReason" | "discardReasonOther">) {
  if (!entry.discardReason) return "";
  return entry.discardReason === DISCARD_REASON_OTHER ? entry.discardReasonOther || DISCARD_REASON_OTHER : entry.discardReason;
}

const ERROR_MESSAGES: Record<string, string> = {
  responsaveis: "Os responsáveis são opcionais, mas se preenchidos precisam vir da equipe cadastrada na aba Equipe.",
  campos: "Confira os campos do contato: a data é obrigatória."
};

export default async function MensagensPage({
  searchParams
}: {
  searchParams?: Record<string, string | undefined>;
}) {
  const { user, studentId } = await requireStaffSection("mensagens");
  const isStaff = user.role === "STAFF";
  const units = studentId ? await getStudentUnits(studentId) : [];
  const activeUnit = selectStudentUnit(units, searchParams?.area);
  const period = parsePeriod(searchParams);
  const dateRange = parseDateRange(searchParams);
  const range = effectiveRange(period, dateRange);
  const page = parsePage(searchParams);
  const query = (searchParams?.q ?? "").trim().slice(0, 80);
  const errorMessage = searchParams?.error ? ERROR_MESSAGES[searchParams.error] : undefined;
  // Opções dos filtros só com os contatos desta clínica (+ listas de Ajustes) — nunca de outro mentorado.
  const filterDefs = await getMessageFilterDefs({ studentId: studentId ?? "" });
  const filters = parseFilters(filterDefs, searchParams);
  const sort = parseSort(MESSAGE_SORT, searchParams);
  // Busca + filtros + ordem + datas: carregados por período, paginação e pela volta depois de salvar.
  const filterParams = { q: query || undefined, ...filters.params, ordem: sort.param, ...dateRangeQuery(dateRange) };

  const [rawEntries, typeOptions, channelOptions, discardReasonOptions, professionals] = await Promise.all([
    prisma.messageEntry.findMany({
      where: {
        studentId: studentId ?? "",
        ...(activeUnit ? { unitId: activeUnit.id } : {}),
        date: { gte: range.start, lte: range.end },
        AND: [
          query
            ? {
                OR: [{ name: { contains: query } }, { contact: { contains: query } }, { reason: { contains: query } }]
              }
            : {},
          ...filters.where
        ]
      },
      orderBy: sort.orderBy,
      ...pageSkipTake(page, LIST_PAGE_SIZE)
    }),
    getPortalOptions("messageTypes"),
    getPortalOptions("channels"),
    getPortalOptions("discardReasons"),
    studentId ? getProfessionals(studentId) : Promise.resolve([])
  ]);
  const { rows: entries, hasNext } = splitPage(rawEntries, LIST_PAGE_SIZE);
  const returnQuery = withParams("", {
    area: activeUnit?.id,
    ...filterParams,
    page: page > 1 ? String(page) : undefined,
    ...periodQuery(period)
  });

  const plainEntries: Array<MessageEntryPlain & { displayDate: string }> = entries.map((entry) => ({
    id: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    displayDate: entry.date.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
    name: entry.name ?? "",
    contact: entry.contact ?? "",
    type: entry.type ?? "",
    channel: entry.channel ?? "",
    approach: entry.approach ?? "",
    scheduledBy: entry.scheduledBy ?? "",
    professional: entry.professional ?? "",
    reason: entry.reason ?? "",
    scheduled: entry.scheduled == null ? "" : entry.scheduled ? "Sim" : "Não",
    attended: (entry.attended as "Sim" | "Não" | "Remarcou" | null) ?? "",
    discardStatus: entry.discardStatus ?? "",
    discardReason: entry.discardReason ?? "",
    discardReasonOther: entry.discardReasonOther ?? "",
    bookedTreatment: entry.bookedTreatment == null ? "" : entry.bookedTreatment ? "Sim" : "Não",
    status: entry.status ?? "",
    observations: entry.observations ?? ""
  }));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Mensagens</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Novo contato</h1>
        </div>
        <AreaSwitcher units={units} activeUnitId={activeUnit?.id} basePath="/app/mensagens" carryParams={periodQuery(period)} />
      </header>
      {searchParams?.saved ? (
        <Toast variant="success">
          Contato registrado com sucesso.
        </Toast>
      ) : null}
      {errorMessage ? (
        <Toast variant="error">{errorMessage}</Toast>
      ) : null}
      <Card>
        <CardContent>
          <MessageEntryForm
            action={createMessageEntry}
            unitId={activeUnit?.id}
            typeOptions={typeOptions}
            channelOptions={channelOptions}
            discardReasonOptions={discardReasonOptions}
            professionals={professionals}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Contatos {effectiveRangePhrase(period, dateRange)}</CardTitle>
          <PeriodSwitcher
            period={period}
            basePath="/app/mensagens"
            carryParams={{ area: activeUnit?.id, q: query || undefined, ...filters.params, ordem: sort.param }}
          />
          <FilterBar
            action="/app/mensagens"
            hidden={{ area: activeUnit?.id, ...periodQuery(period) }}
            carry={{ area: activeUnit?.id, ...periodQuery(period), ...filterParams }}
            query={query}
            searchPlaceholder="Buscar nome, contato, motivo..."
            defs={filterDefs}
            filters={filters}
            sort={MESSAGE_SORT}
            sortValue={sort.value}
            sortChip={sort.chip}
            dateRange={dateRange}
            clearHref={withParams("/app/mensagens", { area: activeUnit?.id, ...periodQuery(period) })}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table w-[1740px] table-fixed text-left text-[13px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-[100px] whitespace-nowrap bg-[rgba(245,247,248,0.98)] py-2">Data</th>
                <th className="sticky left-[100px] z-20 w-[130px] border-r border-r-[rgba(7,16,24,0.14)] bg-[rgba(245,247,248,0.98)]">
                  Nome
                </th>
                <th className="w-[120px]">Contato</th>
                <th className="w-[100px] border-l border-l-[rgba(7,16,24,0.14)]">Tipo</th>
                <th className="w-[110px]">Origem</th>
                <th className="w-[80px]">Agendou</th>
                <th className="w-[100px]">Status</th>
                <th className="w-[110px] border-l border-l-[rgba(7,16,24,0.14)]" title="Responsável pelo Agendamento">
                  Resp. Agend.
                </th>
                <th className="w-[110px]" title="Profissional responsável pelo fechamento da venda">
                  Resp. Fech.
                </th>
                <th className="w-[130px]" title="Motivo do contato ou objeção">
                  Motivo
                </th>
                <th className="w-[90px] border-l border-l-[rgba(7,16,24,0.14)]" title="Abordagem">
                  Abord.
                </th>
                <th className="w-[90px]" title="Atendeu ou respondeu">
                  Atend.
                </th>
                <th className="w-[100px]" title="Descarte">
                  Desc.
                </th>
                <th className="w-[110px]" title="Motivo de Descarte">
                  Mot. Desc.
                </th>
                <th className="w-[80px]" title="Marcou Tratamento?">
                  Trat.
                </th>
                <th className="w-[180px] border-l border-l-[rgba(7,16,24,0.14)]" title="Observações">
                  Obs.
                </th>
              </tr>
            </thead>
            <tbody>
              {plainEntries.map((entry) => {
                const discardReasonText = discardReasonDisplay(entry);
                return (
                  <MessageEntryRow
                    key={entry.id}
                    entry={entry}
                    unitId={activeUnit?.id}
                    updateAction={updateMessageEntry}
                    deleteAction={deleteMessageEntry}
                    typeOptions={typeOptions}
                    channelOptions={channelOptions}
                    discardReasonOptions={discardReasonOptions}
                    professionals={professionals}
                    canDelete={!isStaff}
                    returnQuery={returnQuery}
                  >
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-3 group-hover:bg-[rgba(152,178,196,0.06)]">
                      {entry.displayDate}
                    </td>
                    <td
                      className="sticky left-[100px] z-10 truncate border-r border-r-[rgba(7,16,24,0.14)] bg-white group-hover:bg-[rgba(152,178,196,0.06)]"
                      title={entry.name || undefined}
                    >
                      {entry.name || "-"}
                    </td>
                    <td className="max-w-[120px] truncate" title={entry.contact || undefined}>
                      {entry.contact || "-"}
                    </td>
                    <td className="border-l border-l-[rgba(7,16,24,0.14)]">{entry.type || "-"}</td>
                    <td>{entry.channel || "-"}</td>
                    <td>{entry.scheduled || "-"}</td>
                    <td>
                      {entry.status === "Pendente" ? (
                        <Badge>Pendente</Badge>
                      ) : entry.status === "Finalizado" ? (
                        <Badge variant="ok">Finalizado</Badge>
                      ) : (
                        entry.status || "-"
                      )}
                    </td>
                    <td className="border-l border-l-[rgba(7,16,24,0.14)] max-w-[110px] truncate" title={entry.scheduledBy || undefined}>
                      {entry.scheduledBy || "-"}
                    </td>
                    <td className="max-w-[110px] truncate" title={entry.professional || undefined}>
                      {entry.professional || "-"}
                    </td>
                    <td className="max-w-[130px] truncate" title={entry.reason || undefined}>
                      {entry.reason || "-"}
                    </td>
                    <td className="border-l border-l-[rgba(7,16,24,0.14)]">{entry.approach || "-"}</td>
                    <td>{entry.attended || "-"}</td>
                    <td>{entry.discardStatus ? shortDiscardStatus(entry.discardStatus) : "-"}</td>
                    <td className="max-w-[110px] truncate" title={discardReasonText || undefined}>
                      {discardReasonText || "-"}
                    </td>
                    <td>{entry.bookedTreatment || "-"}</td>
                    <td className="border-l border-l-[rgba(7,16,24,0.14)] max-w-[180px] truncate" title={entry.observations || undefined}>
                      {entry.observations || "-"}
                    </td>
                  </MessageEntryRow>
                );
              })}
              {!plainEntries.length ? (
                <tr>
                  <td className="py-4 text-graphite-700/65" colSpan={16}>
                    {Object.values(filterParams).some(Boolean) ? "Nenhum contato encontrado para esses filtros neste período." : "Nenhum contato registrado neste período."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <Pagination
            page={page}
            count={plainEntries.length}
            hasNext={hasNext}
            basePath="/app/mensagens"
            carryParams={{ area: activeUnit?.id, ...filterParams, ...periodQuery(period) }}
            pageSize={LIST_PAGE_SIZE}
          />
        </CardContent>
      </Card>
    </div>
  );
}
