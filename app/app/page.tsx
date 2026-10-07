import Link from "next/link";
import {
  AlertTriangle,
  Award,
  CalendarDays,
  CalendarClock,
  CalendarRange,
  LayoutGrid,
  MessageSquare,
  PlusCircle,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { MessageStatusChart, PaymentPieChart, RevenueBarChart } from "@/components/charts/dashboard-charts";
import { AreaSwitcher } from "@/components/student/area-switcher";
import { Button, ButtonLink } from "@/components/ui/button";
import { ClearFiltersLink } from "@/components/ui/clear-filters-link";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { requireStaffSection } from "@/lib/guards";
import { getDashboardData, getEstimatedRevenue, getRefundTotal, monthLabelFromKey } from "@/lib/dashboard";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { getUnitGoals } from "@/lib/goals";
import {
  currentMonthKey,
  dateRangeQuery,
  effectiveRange,
  monthKeyOfPeriod,
  parseDateRange,
  parsePeriod,
  periodQuery,
  withParams
} from "@/lib/period";
import { getStudentUnits, selectStudentUnit, studentUnitLabel } from "@/lib/student-units";
import { prisma } from "@/lib/prisma";
import { MONTH_LABELS } from "@/lib/constants";

function fullMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export default async function StudentHomePage({
  searchParams
}: {
  searchParams?: { area?: string; month?: string; year?: string; from?: string; to?: string };
}) {
  const { user, studentId } = await requireStaffSection("dashboard");

  if (!studentId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Você está logado como administrador</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-graphite-700">
          Este é o portal do mentorado. Para acompanhar os resultados de todos os mentorados, use o{" "}
          <Link href="/admin" className="font-semibold text-champagne-700 underline-offset-2 hover:underline">
            dashboard administrativo
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  const units = await getStudentUnits(studentId);
  // Visão consolidada por padrão; uma área específica só quando selecionada.
  const activeUnit =
    units.length === 1 ? units[0] : searchParams?.area ? selectStudentUnit(units, searchParams.area) : null;
  const consolidated = !activeUnit;
  const period = parsePeriod(searchParams);
  const dateRange = parseDateRange(searchParams);
  const range = effectiveRange(period, dateRange);

  const [metrics, goals, estimatedRevenue, refunds, student] = await Promise.all([
    getDashboardData({ studentId, unitId: activeUnit?.id, range }),
    getUnitGoals((activeUnit ? [activeUnit] : units).map((unit) => unit.id)),
    getEstimatedRevenue({ studentId, unitId: activeUnit?.id }, range),
    getRefundTotal({ studentId, unitId: activeUnit?.id }, range),
    prisma.student.findUnique({ where: { id: studentId }, select: { name: true } })
  ]);

  // Nome vem do cadastro atual do mentorado (reflete renomeações na hora,
  // sem depender do nome em cache na sessão do login).
  const displayName = (student?.name ?? user.name ?? "").trim();
  const goalTarget = [...goals.values()].reduce((sum, value) => sum + value, 0);
  const focusMonthKey = monthKeyOfPeriod(period);
  const focusMonthRevenue = metrics.monthlyRevenue.find((row) => row.month === focusMonthKey)?.value ?? 0;
  const isCurrentMonth = focusMonthKey === currentMonthKey();

  const goalRatio = goalTarget > 0 ? focusMonthRevenue / goalTarget : 0;
  const goalStatus: "hit" | "on-pace" | "behind" | "missed" =
    goalTarget <= 0
      ? "behind"
      : focusMonthRevenue >= goalTarget
        ? "hit"
        : isCurrentMonth
          ? goalPace(focusMonthRevenue, goalTarget)
          : "missed";

  return (
    <div className="grid gap-6">
      <section className="premium-panel rounded-xl border border-white/10 p-5 text-ivory shadow-luxury md:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne-300">Visão geral</p>
            <h1 className="mt-3 max-w-2xl font-display text-[clamp(1.75rem,4vw,3.1rem)] font-medium leading-[1.08] tracking-normal text-white">
              {displayName ? `Painel de ${displayName}` : "Painel de performance"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[rgba(245,247,248,0.68)]">
              {consolidated
                ? "Visão consolidada de todas as áreas do seu negócio."
                : `Área ativa: ${studentUnitLabel(activeUnit)}.`}{" "}
              Registre vendas e contatos sem voltar para planilhas.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <ButtonLink href={withParams("/app/financeiro", { area: activeUnit?.id })} className="h-11 justify-center" variant="primary">
              <PlusCircle size={16} />
              Venda
            </ButtonLink>
            <ButtonLink href={withParams("/app/mensagens", { area: activeUnit?.id })} className="h-11 justify-center" variant="secondary">
              <MessageSquare size={16} />
              Mensagem
            </ButtonLink>
          </div>
        </div>
      </section>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Indicadores</p>
          <h2 className="mt-2 font-display text-[1.65rem] font-medium text-ink">
            {consolidated ? "Resumo do negócio" : "Resumo da área"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSwitcher period={period} basePath="/app" carryParams={{ area: activeUnit?.id }} />
          <form className="flex flex-wrap items-center gap-2" action="/app">
            {activeUnit ? <input type="hidden" name="area" value={activeUnit.id} /> : null}
            {period.kind === "month" ? <input type="hidden" name="month" value={period.key} /> : null}
            {periodQuery(period).year ? <input type="hidden" name="year" value={periodQuery(period).year} /> : null}
            <Input name="from" type="date" defaultValue={dateRange?.from ?? ""} aria-label="De" className="h-9 w-[9.5rem] text-sm" />
            <Input name="to" type="date" defaultValue={dateRange?.to ?? ""} aria-label="Até" className="h-9 w-[9.5rem] text-sm" />
            <Button type="submit" variant="secondary" className="h-9 px-3 text-xs">
              Filtrar
            </Button>
          </form>
          <ClearFiltersLink show={Boolean(dateRange)} href={withParams("/app", { area: activeUnit?.id, ...periodQuery(period) })} />
          <AreaSwitcher units={units} activeUnitId={activeUnit?.id} basePath="/app" carryParams={periodQuery(period)} allowAll />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
        <MetricCard
          label="Agendamentos"
          value={formatNumber(metrics.scheduled)}
          detail={`${formatPercent(metrics.conversionRate)} de conversão`}
        />
        <MetricCard label="Pendências" value={formatNumber(metrics.pending)} hint="Mensagens marcadas como pendentes, para acompanhar." />
        <MetricCard
          label="Alertas"
          value={formatNumber(metrics.financeAlerts.length)}
          hint="Vendas em que o total não bate com a soma dos meios de pagamento."
        />
      </section>

      {goalTarget > 0 && !dateRange ? (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Target size={18} />
              Meta de {fullMonthLabel(focusMonthKey)}
              {consolidated ? " · todas as áreas" : ""}
            </CardTitle>
            <GoalBadge status={goalStatus} />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-2xl font-semibold text-ink">{formatCurrency(focusMonthRevenue)}</p>
              <p className="text-sm text-graphite-700/70">
                de {formatCurrency(goalTarget)} · {formatPercent(goalRatio)}
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[rgba(0,6,35,0.08)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#607889] via-[#98b2c4] to-[#e6eef3] transition-all"
                style={{ width: `${Math.min(100, Math.round(goalRatio * 100))}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-graphite-700/65">
              {goalStatus === "hit"
                ? "Meta batida. Excelente trabalho."
                : isCurrentMonth
                  ? `Faltam ${formatCurrency(Math.max(0, goalTarget - focusMonthRevenue))} para bater a meta deste mês.`
                  : "Mês encerrado abaixo da meta."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {metrics.totalFinanceEntries || metrics.totalMessageEntries ? (
        <>
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

          {consolidated && metrics.revenueByUnit.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid size={18} />
                  Vendas por área
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {metrics.revenueByUnit.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 border-b border-[rgba(0,6,35,0.08)] py-2 text-sm">
                      <span className="min-w-0 break-words font-medium">{row.label}</span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <span className="text-xs text-graphite-700/65">
                          {formatNumber(row.count)} {row.count === 1 ? "venda" : "vendas"}
                        </span>
                        <strong>{formatCurrency(row.value)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {metrics.revenueBySpecialty.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award size={18} />
                  Faturamento por especialidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {metrics.revenueBySpecialty.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 border-b border-[rgba(0,6,35,0.08)] py-2 text-sm">
                      <span className="min-w-0 break-words font-medium">{row.label}</span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <span className="text-xs text-graphite-700/65">
                          {formatNumber(row.count)} {row.count === 1 ? "venda" : "vendas"}
                        </span>
                        <strong>{formatCurrency(row.value)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {period.kind === "month" && !dateRange ? (
            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarRange size={18} />
                    Vendas por semana
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RevenueBarChart data={metrics.weeklyRevenue} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarRange size={18} />
                    Agendamentos por semana
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {metrics.weeklyScheduled.map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-3 border-b border-[rgba(0,6,35,0.08)] py-2 text-sm">
                        <span className="min-w-0 break-words font-medium">{row.label}</span>
                        <span className="flex shrink-0 items-baseline gap-3 text-xs text-graphite-700/65">
                          <span>{formatNumber(row.scheduled)} agendados</span>
                          <span>{formatNumber(row.notScheduled)} não agendados</span>
                        </span>
                      </div>
                    ))}
                    {!metrics.weeklyScheduled.length ? (
                      <p className="py-2 text-sm text-graphite-700/65">Nenhuma mensagem no período selecionado.</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </section>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare size={18} />
                  Mensagens e agendamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MessageStatusChart data={metrics.messageStatus} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays size={18} />
                  Resumo mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {metrics.monthlyRevenue.map((row) => (
                    <div key={row.month} className="flex items-center justify-between gap-3 border-b border-[rgba(0,6,35,0.08)] py-2 text-sm">
                      <span>{monthLabelFromKey(row.month)}</span>
                      <span className="flex items-baseline gap-3">
                        <span className="text-xs text-graphite-700/65">
                          {formatNumber(row.count)} {row.count === 1 ? "venda" : "vendas"}
                        </span>
                        <strong>{formatCurrency(row.value)}</strong>
                      </span>
                    </div>
                  ))}
                  {!metrics.monthlyRevenue.length ? (
                    <p className="py-2 text-sm text-graphite-700/65">Nenhuma venda no período selecionado.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <Card>
          <CardContent>
            <EmptyState icon={CalendarClock} text="Nenhum registro no período selecionado. Ajuste o período acima ou registre uma venda." />
          </CardContent>
        </Card>
      )}

      {metrics.financeAlerts.length ? (
        <Card className="border-champagne-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-champagne-700">
              <AlertTriangle size={18} />
              Conferência necessária
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-graphite-700">
            Existem vendas em que o total não bate com a soma dos meios de pagamento.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function goalPace(revenue: number, target: number): "on-pace" | "behind" {
  const now = new Date();
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return revenue / target >= (day / daysInMonth) * 0.9 ? "on-pace" : "behind";
}

function GoalBadge({ status }: { status: "hit" | "on-pace" | "behind" | "missed" }) {
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
  return (
    <span className={`inline-flex items-center rounded-sm border px-2 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-graphite-950/15 bg-[rgba(255,255,255,0.48)] p-4 text-sm text-graphite-700/70">
      <Icon size={18} />
      {text}
    </div>
  );
}
