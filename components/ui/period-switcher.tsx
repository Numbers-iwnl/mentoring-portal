import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { periodLabel, periodQuery, shiftPeriod, togglePeriodKind, withParams, type Period } from "@/lib/period";

export function PeriodSwitcher({
  period,
  basePath,
  carryParams = {}
}: {
  period: Period;
  basePath: string;
  carryParams?: Record<string, string | undefined>;
}) {
  const href = (target: Period) => withParams(basePath, { ...carryParams, ...periodQuery(target) });
  const toggled = togglePeriodKind(period);

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-graphite-950/10 bg-[rgba(255,255,255,0.88)] p-1 shadow-sm">
      <Link
        aria-label="Período anterior"
        href={href(shiftPeriod(period, -1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-graphite-700 transition hover:bg-champagne-100 hover:text-ink"
      >
        <ChevronLeft size={16} />
      </Link>
      <span className="inline-flex h-8 min-w-[8.5rem] items-center justify-center gap-2 px-2 text-sm font-semibold text-ink">
        <CalendarDays size={14} className="text-champagne-700" />
        {periodLabel(period)}
      </span>
      <Link
        aria-label="Próximo período"
        href={href(shiftPeriod(period, 1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-graphite-700 transition hover:bg-champagne-100 hover:text-ink"
      >
        <ChevronRight size={16} />
      </Link>
      <Link
        href={href(toggled)}
        className="ml-1 inline-flex h-8 items-center rounded-sm border border-[rgba(0,6,35,0.08)] bg-ivory/70 px-2.5 text-xs font-semibold text-graphite-700 transition hover:border-champagne-500/50 hover:bg-champagne-100"
      >
        {period.kind === "month" ? "Ver ano" : "Ver mês"}
      </Link>
    </div>
  );
}
