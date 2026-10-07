import { Prisma } from "@prisma/client";
import type { FinanceEntry, MessageEntry, StudentUnit } from "@prisma/client";
import { prisma } from "./prisma";
import { MONTH_LABELS } from "./constants";
import { monthKey, weekLabel, weekOfMonth, yearRange } from "./dates";
import { toNumber } from "./format";
import { readStoredPayments, receiptsInRange } from "./payments";
import { studentUnitLabel } from "./student-units";
import { hasFinanceMismatch } from "./validation";

export function monthLabelFromKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = MONTH_LABELS[(month ?? 0) - 1];
  if (!label) return key;
  return `${label.slice(0, 3)}/${String(year).slice(2)}`;
}

export type DashboardFilters = {
  studentId?: string;
  unitId?: string;
  year?: number;
  range?: { start: Date; end: Date };
};

export async function getDashboardData(filters: DashboardFilters = {}) {
  const range = filters.range ?? yearRange(filters.year);
  const where: Prisma.FinanceEntryWhereInput = {
    date: { gte: range.start, lte: range.end },
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.unitId ? { unitId: filters.unitId } : {})
  };
  const messageWhere: Prisma.MessageEntryWhereInput = {
    date: { gte: range.start, lte: range.end },
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.unitId ? { unitId: filters.unitId } : {})
  };

  const [financeEntries, messageEntries, students] = await Promise.all([
    prisma.financeEntry.findMany({ where, include: { student: true, unit: true }, orderBy: { date: "asc" } }),
    prisma.messageEntry.findMany({ where: messageWhere, include: { student: true, unit: true }, orderBy: { date: "asc" } }),
    prisma.student.findMany({
      where: filters.studentId
        ? { id: filters.studentId, active: true }
        : filters.unitId
          ? { active: true, units: { some: { id: filters.unitId } } }
          : { active: true },
      orderBy: { name: "asc" }
    })
  ]);

  return buildDashboardMetrics(financeEntries, messageEntries, students.length);
}

export function buildDashboardMetrics(
  financeEntries: Array<FinanceEntry & { student?: { name: string } | null; unit?: Pick<StudentUnit, "name" | "type"> | null }>,
  messageEntries: Array<MessageEntry & { student?: { name: string } | null }>,
  activeStudents = 0
) {
  const monthlyRevenue = new Map<string, { value: number; count: number }>();
  const weeklyRevenue = new Map<string, number>();
  const weeklyScheduled = new Map<string, { scheduled: number; notScheduled: number }>();
  const paymentBreakdown = new Map<string, { value: number; count: number }>();
  const revenueByStudent = new Map<string, { value: number; count: number }>();
  const revenueByUnit = new Map<string, { value: number; count: number }>();
  const revenueBySpecialty = new Map<string, { value: number; count: number }>();

  const financeAlerts = financeEntries.filter((entry) =>
    hasFinanceMismatch({
      total: toNumber(entry.total),
      cash: toNumber(entry.cash),
      pix: toNumber(entry.pix),
      card: toNumber(entry.card),
      transfer: toNumber(entry.transfer),
      payments: entry.payments ?? null
    })
  );

  // Soma o valor por método e conta em quantas vendas cada método aparece
  // (uma venda dividida em dois métodos conta uma vez para cada método).
  const addPayments = (methodAmounts: Map<string, number>) => {
    for (const [method, amount] of methodAmounts) {
      if (amount <= 0) continue;
      const bucket = paymentBreakdown.get(method) ?? { value: 0, count: 0 };
      bucket.value += amount;
      bucket.count += 1;
      paymentBreakdown.set(method, bucket);
    }
  };

  for (const entry of financeEntries) {
    const date = entry.date;
    const total = toNumber(entry.total);
    const month = monthlyRevenue.get(monthKey(date)) ?? { value: 0, count: 0 };
    month.value += total;
    month.count += 1;
    monthlyRevenue.set(monthKey(date), month);
    const week = `${monthKey(date)}:${weekOfMonth(date)}`;
    weeklyRevenue.set(week, (weeklyRevenue.get(week) ?? 0) + total);

    // Formas de pagamento estruturadas quando existem; colunas legadas caso contrário.
    const stored = readStoredPayments(entry.payments ?? null);
    const entryMethods = new Map<string, number>();
    if (stored) {
      for (const payment of stored) {
        entryMethods.set(payment.method, (entryMethods.get(payment.method) ?? 0) + payment.amount);
      }
    } else {
      entryMethods.set("Dinheiro", toNumber(entry.cash));
      entryMethods.set("PIX", toNumber(entry.pix));
      entryMethods.set("Cartão", toNumber(entry.card));
      entryMethods.set("Transferência", toNumber(entry.transfer));
    }
    addPayments(entryMethods);

    const studentName = [entry.student?.name ?? "Sem aluno", entry.unit ? studentUnitLabel(entry.unit) : null].filter(Boolean).join(" · ");
    const byStudent = revenueByStudent.get(studentName) ?? { value: 0, count: 0 };
    byStudent.value += total;
    byStudent.count += 1;
    revenueByStudent.set(studentName, byStudent);

    const unitLabel = entry.unit ? studentUnitLabel(entry.unit) : "Sem área";
    const byUnit = revenueByUnit.get(unitLabel) ?? { value: 0, count: 0 };
    byUnit.value += total;
    byUnit.count += 1;
    revenueByUnit.set(unitLabel, byUnit);

    // Só entra na quebra por especialidade quem tem especialidade preenchida.
    if (entry.specialty) {
      const bySpecialty = revenueBySpecialty.get(entry.specialty) ?? { value: 0, count: 0 };
      bySpecialty.value += total;
      bySpecialty.count += 1;
      revenueBySpecialty.set(entry.specialty, bySpecialty);
    }
  }

  for (const entry of messageEntries) {
    const week = `${monthKey(entry.date)}:${weekOfMonth(entry.date)}`;
    const bucket = weeklyScheduled.get(week) ?? { scheduled: 0, notScheduled: 0 };
    if (entry.scheduled === true) bucket.scheduled += 1;
    else if (entry.scheduled === false) bucket.notScheduled += 1;
    weeklyScheduled.set(week, bucket);
  }

  const scheduled = messageEntries.filter((entry) => entry.scheduled === true).length;
  const notScheduled = messageEntries.filter((entry) => entry.scheduled === false).length;
  const pending = messageEntries.filter((entry) => entry.status === "Pendente").length;
  const finalized = messageEntries.filter((entry) => entry.status === "Finalizado").length;
  const conversionRate = scheduled + notScheduled === 0 ? 0 : scheduled / (scheduled + notScheduled);

  return {
    activeStudents,
    totalRevenue: financeEntries.reduce((sum, entry) => sum + toNumber(entry.total), 0),
    totalFinanceEntries: financeEntries.length,
    totalMessageEntries: messageEntries.length,
    scheduled,
    notScheduled,
    pending,
    finalized,
    conversionRate,
    financeAlerts,
    monthlyRevenue: [...monthlyRevenue.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, label: monthLabelFromKey(month), value: data.value, count: data.count })),
    weeklyRevenue: [...weeklyRevenue.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const [month, week] = key.split(":");
        return { key, label: `${monthLabelFromKey(month)} · Semana ${week}`, value };
      }),
    weeklyScheduled: [...weeklyScheduled.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [month, week] = key.split(":");
        return { key, label: `${monthLabelFromKey(month)} · Semana ${week}`, ...data };
      }),
    paymentBreakdown: [...paymentBreakdown.entries()]
      .map(([method, data]) => ({ method, value: data.value, count: data.count }))
      .sort((a, b) => b.value - a.value),
    revenueByStudent: [...revenueByStudent.entries()]
      .map(([student, data]) => ({ student, value: data.value, count: data.count }))
      .sort((a, b) => b.value - a.value),
    revenueByUnit: [...revenueByUnit.entries()]
      .map(([label, data]) => ({ label, value: data.value, count: data.count }))
      .sort((a, b) => b.value - a.value),
    revenueBySpecialty: [...revenueBySpecialty.entries()]
      .map(([label, data]) => ({ label, value: data.value, count: data.count }))
      .sort((a, b) => b.value - a.value),
    messageStatus: [
      { label: "Agendou", value: scheduled },
      { label: "Não agendou", value: notScheduled },
      { label: "Finalizado", value: finalized },
      { label: "Pendente", value: pending }
    ]
  };
}

/**
 * Faturamento Estimado: soma dos recebimentos previstos dentro do período,
 * incluindo parcelas de vendas feitas em meses anteriores. Busca vendas de
 * até 36 meses antes do início do período (janela suficiente para parcelas).
 */
export async function getEstimatedRevenue(
  filters: Pick<DashboardFilters, "studentId" | "unitId">,
  range: { start: Date; end: Date }
) {
  const lookbackStart = new Date(Date.UTC(range.start.getUTCFullYear() - 3, range.start.getUTCMonth(), 1));
  const entries = await prisma.financeEntry.findMany({
    where: {
      payments: { not: Prisma.DbNull },
      date: { gte: lookbackStart, lte: range.end },
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      ...(filters.unitId ? { unitId: filters.unitId } : {})
    },
    select: { payments: true }
  });

  let estimated = 0;
  for (const entry of entries) {
    const payments = readStoredPayments(entry.payments);
    if (payments) estimated += receiptsInRange(payments, range.start, range.end);
  }
  return Math.round(estimated * 100) / 100;
}

/**
 * Total estornado no período: soma de refundAmount pelas vendas cujo estorno
 * foi REGISTRADO dentro do período (refundedAt), não pela data da venda
 * original — uma venda de um mês anterior estornada agora conta no mês atual.
 */
export async function getRefundTotal(
  filters: Pick<DashboardFilters, "studentId" | "unitId">,
  range: { start: Date; end: Date }
) {
  const result = await prisma.financeEntry.aggregate({
    where: {
      refundedAt: { gte: range.start, lte: range.end },
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      ...(filters.unitId ? { unitId: filters.unitId } : {})
    },
    _sum: { refundAmount: true },
    _count: true
  });
  return { total: toNumber(result._sum.refundAmount), count: result._count };
}

export function weeklyFinanceRows(entries: FinanceEntry[]) {
  const rows = new Map<string, { label: string; value: number }>();
  for (const entry of entries) {
    const key = `${monthKey(entry.date)}:${weekOfMonth(entry.date)}`;
    const existing = rows.get(key) ?? { label: weekLabel(entry.date), value: 0 };
    existing.value += toNumber(entry.total);
    rows.set(key, existing);
  }
  return [...rows.values()];
}
