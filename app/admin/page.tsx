import { AlertTriangle, Download, MessageSquare, Target, TrendingUp, Users, Wallet } from "lucide-react";
import { RevenueBarChart, MessageStatusChart, PaymentPieChart } from "@/components/charts/dashboard-charts";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClearFiltersLink } from "@/components/ui/clear-filters-link";
import { Field, Input, Select } from "@/components/ui/field";
import { MetricCard } from "@/components/ui/metric-card";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { MONTH_LABELS } from "@/lib/constants";
import { getDashboardData, getEstimatedRevenue, getRefundTotal } from "@/lib/dashboard";
import { formatCurrency, formatNumber, formatPercent, toNumber } from "@/lib/format";
import { getUnitGoals } from "@/lib/goals";
import { requireAdmin } from "@/lib/guards";
import { currentMonthKey, effectiveRange, monthKeyOfPeriod, parseDateRange, parsePeriod, periodQuery, withParams } from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { studentUnitLabel } from "@/lib/student-units";

function fullMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams?: { studentId?: string; unitId?: string; month?: string; year?: string; from?: string; to?: string };
}) {
  await requireAdmin();
  const students = await prisma.student.findMany({
    where: { active: true },
    include: { units: { where: { active: true }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] } },
    orderBy: { name: "asc" }
  });
  const selectedStudentId = students.some((student) => student.id === searchParams?.studentId) ? searchParams?.studentId : undefined;
  const availableUnitOptions = selectedStudentId
    ? (students.find((student) => student.id === selectedStudentId)?.units ?? []).map((unit) => ({
        id: unit.id,
        label: studentUnitLabel(unit)
      }))
    : students.flatMap((student) =>
        student.units.map((unit) => ({
          id: unit.id,
          label: `${student.name} · ${studentUnitLabel(unit)}`
        }))
      );
  const selectedUnitId = availableUnitOptions.some((unit) => unit.id === searchParams?.unitId) ? searchParams?.unitId : undefined;

  const period = parsePeriod(searchParams);
  const dateRange = parseDateRange(searchParams);
  const range = effectiveRange(period, dateRange);
  const [metrics, estimatedRevenue, refunds] = await Promise.all([
    getDashboardData({ studentId: selectedStudentId, unitId: selectedUnitId, range }),
    getEstimatedRevenue({ studentId: selectedStudentId, unitId: selectedUnitId }, range),
    getRefundTotal({ studentId: selectedStudentId, unitId: selectedUnitId }, range)
  ]);

  const focusMonthKey = monthKeyOfPeriod(period);
  const isCurrentMonth = focusMonthKey === currentMonthKey();
  const allUnits = students.flatMap((student) => student.units.map((unit) => ({ unit, student })));
  const goals = await getUnitGoals(allUnits.map(({ unit }) => unit.id));
  const unitsWithGoals = allUnits.filter(({ unit }) => (goals.get(unit.id) ?? 0) > 0);

  let goalRows: Array<{ label: string; target: number; revenue: number }> = [];
  if (unitsWithGoals.length) {
    const [year, month] = focusMonthKey.split("-").map(Number);
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const revenueByUnit = await prisma.financeEntry.groupBy({
      by: ["unitId"],
      where: { unitId: { in: unitsWithGoals.map(({ unit }) => unit.id) }, date: { gte: monthStart, lte: monthEnd } },
      _sum: { total: true }
    });
    const revenueMap = new Map(revenueByUnit.map((row) => [row.unitId, toNumber(row._sum.total)]));
    goalRows = unitsWithGoals
      .map(({ unit, student }) => ({
        label: `${student.name} · ${studentUnitLabel(unit)}`,
        target: goals.get(unit.id) ?? 0,
        revenue: revenueMap.get(unit.id) ?? 0
      }))
      .sort((a, b) => b.revenue / b.target - a.revenue / a.target);
  }

  const filterParams: Record<string, string | undefined> = {
    studentId: selectedStudentId,
    unitId: selectedUnitId,
    ...periodQuery(period)
  };

  return (
    <div className="grid gap-6">
      <header className="premium-panel rounded-xl border border-white/10 p-5 text-ivory shadow-luxury md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne-300">Dashboard</p>
        <h1 className="mt-3 max-w-3xl font-display text-[clamp(1.9rem,4.2vw,3.3rem)] font-medium leading-[1.05] tracking-normal text-white">
          Performance dos mentorados
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[rgba(245,247,248,0.66)]">
          Compare mentorados, áreas e resultados em uma visão executiva para decisões rápidas.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Filtros de performance</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSwitcher period={period} basePath="/admin" carryParams={{ studentId: selectedStudentId, unitId: selectedUnitId }} />
            <ClearFiltersLink
              show={Boolean(dateRange)}
              href={withParams("/admin", { studentId: selectedStudentId, unitId: selectedUnitId, ...periodQuery(period) })}
            />
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={withParams("/api/exports/finance", { format: "xlsx", ...filterParams })} variant="secondary" className="h-9 px-3 text-xs">
                <Download size={14} />
                Exportar vendas
              </ButtonLink>
              <ButtonLink href={withParams("/api/exports/messages", { format: "xlsx", ...filterParams })} variant="secondary" className="h-9 px-3 text-xs">
                <Download size={14} />
                Exportar mensagens
              </ButtonLink>
              <ButtonLink href={withParams("/api/exports/costs", { format: "xlsx", studentId: selectedStudentId, unitId: selectedUnitId })} variant="secondary" className="h-9 px-3 text-xs">
                <Download size={14} />
                Exportar custo/hora
              </ButtonLink>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto_auto]" action="/admin">
            {period.kind === "month" ? <input type="hidden" name="month" value={period.key} /> : null}
            {periodQuery(period).year ? <input type="hidden" name="year" value={periodQuery(period).year} /> : null}
            <Field label="Mentorado">
              <Select name="studentId" defaultValue={selectedStudentId ?? ""}>
                <option value="">Todos os mentorados</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Área">
              <Select name="unitId" defaultValue={selectedUnitId ?? ""}>
                <option value="">Todas as áreas</option>
                {availableUnitOptions.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="De">
              <Input name="from" type="date" defaultValue={dateRange?.from ?? ""} />
            </Field>
            <Field label="Até">
              <Input name="to" type="date" defaultValue={dateRange?.to ?? ""} />
            </Field>
            <div className="flex items-end">
              <Button className="w-full" type="submit" variant="secondary">
                Aplicar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Valor bruto de vendas"
          value={formatCurrency(metrics.totalRevenue)}
          detail={`${formatNumber(metrics.totalFinanceEntries)} ${metrics.totalFinanceEntries === 1 ? "venda" : "vendas"}`}
          negativeDetail={
            refunds.total > 0
              ? `− ${formatCurrency(refunds.total)} estornado (${formatNumber(refunds.count)} ${refunds.count === 1 ? "venda" : "vendas"})`
              : undefined
          }
          hint="Refere-se ao valor total bruto das vendas realizadas no período, independente da condição de pagamento. O valor estornado (quando houver) é o total marcado como Estorno dentro deste período, mesmo que a venda original seja de um mês anterior."
          hintAlign="start"
        />
        <MetricCard
          label="Faturamento estimado"
          value={formatCurrency(estimatedRevenue)}
          hint="Quanto está previsto para entrar no caixa, considerando a forma de pagamento."
        />
        <MetricCard label="Mentorados" value={formatNumber(metrics.activeStudents)} detail="Ativos" />
        <MetricCard label="Agendamentos" value={formatNumber(metrics.scheduled)} detail={`${formatPercent(metrics.conversionRate)} de conversão`} />
        <MetricCard label="Pendentes" value={formatNumber(metrics.pending)} hint="Mensagens marcadas como pendentes, para follow-up." />
        <MetricCard
          label="Alertas"
          value={formatNumber(metrics.financeAlerts.length)}
          hint="Vendas em que o total não bate com a soma dos meios de pagamento."
        />
      </section>

      {goalRows.length && !dateRange ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target size={18} />
              Metas de {fullMonthLabel(focusMonthKey)}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="data-table min-w-[720px] text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2">Mentorado · Área</th>
                  <th className="text-right">Meta</th>
                  <th className="text-right">Realizado</th>
                  <th className="w-56">Progresso</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {goalRows.map((row) => {
                  const ratio = row.revenue / row.target;
                  const status = row.revenue >= row.target ? "hit" : isCurrentMonth ? paceStatus(ratio) : "missed";
                  return (
                    <tr key={row.label}>
                      <td className="py-3 font-medium">{row.label}</td>
                      <td className="text-right tabular-nums">{formatCurrency(row.target)}</td>
                      <td className="text-right font-semibold tabular-nums">{formatCurrency(row.revenue)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(0,6,35,0.08)]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#607889] via-[#98b2c4] to-[#e6eef3]"
                              style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs font-semibold text-graphite-700">{formatPercent(ratio)}</span>
                        </div>
                      </td>
                      <td>
                        <GoalStatusBadge status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={18} />
              Vendas brutas mensais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBarChart data={metrics.monthlyRevenue} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet size={18} />
              Métodos de pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentPieChart data={metrics.paymentBreakdown} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare size={18} />
              Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MessageStatusChart data={metrics.messageStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={18} />
              Vendas por mentorado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {metrics.revenueByStudent.map((row) => (
                <div key={row.student} className="flex items-center justify-between gap-3 border-b border-[rgba(0,6,35,0.08)] py-2 text-sm">
                  <span className="min-w-0 break-words">{row.student}</span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="text-xs text-graphite-700/65">
                      {formatNumber(row.count)} {row.count === 1 ? "venda" : "vendas"}
                    </span>
                    <strong>{formatCurrency(row.value)}</strong>
                  </span>
                </div>
              ))}
              {!metrics.revenueByStudent.length ? <p className="text-sm text-graphite-700/65">Nenhuma venda no período selecionado.</p> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      {metrics.financeAlerts.length ? (
        <Card className="border-champagne-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-champagne-700">
              <AlertTriangle size={18} />
              Alertas de vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-graphite-700">
            {metrics.financeAlerts.length} lançamento(s) têm total diferente da soma dos meios de pagamento.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function paceStatus(ratio: number): "on-pace" | "behind" {
  const now = new Date();
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return ratio >= (day / daysInMonth) * 0.9 ? "on-pace" : "behind";
}

function GoalStatusBadge({ status }: { status: "hit" | "on-pace" | "behind" | "missed" }) {
  const styles: Record<string, string> = {
    hit: "border-emerald-700/25 bg-emerald-50 text-emerald-900",
    "on-pace": "border-champagne-500/40 bg-champagne-100 text-champagne-700",
    behind: "border-red-900/20 bg-red-50 text-red-900",
    missed: "border-graphite-950/15 bg-graphite-950/[0.04] text-graphite-700"
  };
  const labels: Record<string, string> = {
    hit: "Meta batida",
    "on-pace": "No ritmo",
    behind: "Abaixo do ritmo",
    missed: "Não batida"
  };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}
