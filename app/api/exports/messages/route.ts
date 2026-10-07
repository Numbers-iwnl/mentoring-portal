import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { rowsToCsv, rowsToXlsxBuffer, type ExportColumn } from "@/lib/export";
import { dateRangeToRange, parseDateRange, parsePeriod, periodRange } from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { studentUnitLabel } from "@/lib/student-units";

const COLUMNS: ExportColumn[] = [
  { header: "Data", key: "date", type: "date", width: 12 },
  { header: "Cliente", key: "student", width: 24 },
  { header: "Área", key: "area", width: 18 },
  { header: "Nome", key: "name", width: 24 },
  { header: "Contato", key: "contact", width: 22 },
  { header: "Tipo", key: "type", width: 14 },
  { header: "Origem", key: "channel", width: 14 },
  { header: "Abordagem", key: "approach", width: 14 },
  { header: "Responsável pelo Agendamento", key: "scheduledBy", width: 28 },
  { header: "Profissional responsável pelo fechamento da venda", key: "professional", width: 40 },
  { header: "Motivo", key: "reason", width: 26 },
  { header: "Agendou", key: "scheduled", width: 10 },
  { header: "Atendeu", key: "attended", width: 12 },
  { header: "Marcou Tratamento", key: "bookedTreatment", width: 16 },
  { header: "Descarte", key: "discardStatus", width: 18 },
  { header: "Motivo de Descarte", key: "discardReason", width: 20 },
  { header: "Detalhe do motivo", key: "discardReasonOther", width: 26 },
  { header: "Status", key: "status", width: 12 },
  { header: "Observações", key: "observations", width: 34 },
  { header: "Como foi cadastrado", key: "source", width: 16 }
];

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "xlsx";
  const studentId = user.role === "ADMIN" ? url.searchParams.get("studentId") ?? undefined : user.studentId ?? "__none__";
  const unitId = url.searchParams.get("unitId") ?? undefined;
  const dateRange = parseDateRange({ from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
  const hasPeriod = url.searchParams.get("month") || url.searchParams.get("year");
  // Sem "de/até" nem mês/ano na URL, exporta tudo (sem filtro de data) — o "de/até" sempre
  // vence o mês/ano quando os dois vêm juntos, igual ao resto do app (ver effectiveRange).
  const range = dateRange
    ? dateRangeToRange(dateRange)
    : hasPeriod
      ? periodRange(parsePeriod({ month: url.searchParams.get("month") ?? undefined, year: url.searchParams.get("year") ?? undefined }))
      : undefined;
  const entries = await prisma.messageEntry.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(unitId ? { unitId } : {}),
      ...(range ? { date: { gte: range.start, lte: range.end } } : {})
    },
    include: { student: true, unit: true },
    orderBy: { date: "desc" }
  });

  const rows = entries.map((entry) => ({
    date: entry.date,
    student: entry.student.name,
    area: studentUnitLabel(entry.unit),
    name: entry.name ?? "",
    contact: entry.contact ?? "",
    type: entry.type ?? "",
    channel: entry.channel ?? "",
    approach: entry.approach ?? "",
    scheduledBy: entry.scheduledBy ?? "",
    professional: entry.professional ?? "",
    reason: entry.reason ?? "",
    scheduled: entry.scheduled == null ? "" : entry.scheduled ? "Sim" : "Não",
    attended: entry.attended ?? "",
    bookedTreatment: entry.bookedTreatment == null ? "" : entry.bookedTreatment ? "Sim" : "Não",
    discardStatus: entry.discardStatus ?? "",
    discardReason: entry.discardReason ?? "",
    discardReasonOther: entry.discardReasonOther ?? "",
    status: entry.status ?? "",
    observations: entry.observations ?? "",
    source: entry.source === "IMPORT" ? "Importado" : "Manual"
  }));

  if (format === "csv") {
    return new NextResponse(rowsToCsv(rows, COLUMNS), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=mensagens.csv"
      }
    });
  }

  const buffer = await rowsToXlsxBuffer("Mensagens", rows, COLUMNS);
  return new NextResponse(buffer as BodyInit, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=mensagens.xlsx"
    }
  });
}
