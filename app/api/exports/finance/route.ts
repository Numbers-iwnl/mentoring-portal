import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { rowsToCsv, rowsToXlsxBuffer, type ExportColumn } from "@/lib/export";
import { toNumber } from "@/lib/format";
import { paymentsSummary, readStoredPayments } from "@/lib/payments";
import { dateRangeToRange, parseDateRange, parsePeriod, periodRange } from "@/lib/period";
import { studentUnitLabel } from "@/lib/student-units";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const COLUMNS: ExportColumn[] = [
  { header: "Data", key: "date", type: "date", width: 12 },
  { header: "Cliente", key: "student", width: 24 },
  { header: "Área", key: "area", width: 18 },
  { header: "Paciente / Cliente", key: "patient", width: 26 },
  { header: "Tipo de atendimento", key: "serviceType", width: 18 },
  { header: "Descrição", key: "treatment", width: 34 },
  { header: "Especialidade", key: "specialty", width: 22 },
  { header: "Total", key: "total", type: "currency" },
  { header: "Formas de pagamento", key: "paymentForms", width: 44 },
  { header: "Canal de pagamento", key: "paymentChannels", width: 22 },
  { header: "Responsável pelo agendamento", key: "professional", width: 28 },
  { header: "Profissional responsável pelo fechamento da venda", key: "closer", width: 40 },
  { header: "Observações", key: "observations", width: 34 },
  { header: "Valor estornado", key: "refundAmount", type: "currency" },
  { header: "Data do estorno", key: "refundedAt", type: "date", width: 14 },
  { header: "Origem", key: "source", width: 10 }
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
  const entries = await prisma.financeEntry.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(unitId ? { unitId } : {}),
      ...(range ? { date: { gte: range.start, lte: range.end } } : {})
    },
    include: { student: true, unit: true },
    orderBy: { date: "desc" }
  });

  const rows = entries.map((entry) => {
    const stored = readStoredPayments(entry.payments);
    const legacyParts = [
      toNumber(entry.cash) > 0 ? `Dinheiro ${formatBRL(toNumber(entry.cash))}` : "",
      toNumber(entry.pix) > 0 ? `PIX ${formatBRL(toNumber(entry.pix))}` : "",
      toNumber(entry.card) > 0 ? `Cartão ${formatBRL(toNumber(entry.card))}` : "",
      toNumber(entry.transfer) > 0 ? `Transferência ${formatBRL(toNumber(entry.transfer))}` : ""
    ].filter(Boolean);
    return {
      date: entry.date,
      student: entry.student.name,
      area: studentUnitLabel(entry.unit),
      patient: entry.patientName ?? "",
      serviceType: entry.serviceType ?? "",
      treatment: entry.treatment ?? "",
      specialty: entry.specialty ?? "",
      total: toNumber(entry.total),
      paymentForms: stored ? paymentsSummary(stored) : legacyParts.join(" · "),
      paymentChannels: stored ? [...new Set(stored.map((p) => p.channel).filter(Boolean))].join(" · ") : "",
      professional: entry.professional ?? "",
      closer: entry.closer ?? "",
      observations: entry.observations ?? "",
      refundAmount: toNumber(entry.refundAmount),
      refundedAt: entry.refundedAt,
      source: entry.source === "IMPORT" ? "Importado" : "Manual"
    };
  });

  if (format === "csv") {
    return new NextResponse(rowsToCsv(rows, COLUMNS), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=vendas.csv"
      }
    });
  }

  const buffer = await rowsToXlsxBuffer("Vendas", rows, COLUMNS);
  return new NextResponse(buffer as BodyInit, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=vendas.xlsx"
    }
  });
}
