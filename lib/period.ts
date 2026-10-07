import { MONTH_LABELS, TIME_ZONE } from "./constants";

export type Period = { kind: "month"; key: string } | { kind: "year"; year: number };

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonthKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export function currentYear(now = new Date()) {
  return Number(currentMonthKey(now).slice(0, 4));
}

export function parsePeriod(searchParams?: { month?: string; year?: string }): Period {
  const month = searchParams?.month;
  if (month && MONTH_KEY_PATTERN.test(month)) {
    return { kind: "month", key: month };
  }
  const year = Number(searchParams?.year);
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    return { kind: "year", year };
  }
  return { kind: "year", year: currentYear() };
}

export function periodRange(period: Period) {
  if (period.kind === "month") {
    const [year, month] = period.key.split("-").map(Number);
    return {
      start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
      end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
    };
  }
  return {
    start: new Date(Date.UTC(period.year, 0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(period.year, 11, 31, 23, 59, 59, 999))
  };
}

export function periodLabel(period: Period) {
  if (period.kind === "month") {
    const [year, month] = period.key.split("-").map(Number);
    return `${MONTH_LABELS[month - 1]} ${year}`;
  }
  return `Ano de ${period.year}`;
}

export function shiftPeriod(period: Period, delta: 1 | -1): Period {
  if (period.kind === "month") {
    const [year, month] = period.key.split("-").map(Number);
    const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
    return { kind: "month", key: `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}` };
  }
  return { kind: "year", year: period.year + delta };
}

export function togglePeriodKind(period: Period): Period {
  if (period.kind === "month") {
    return { kind: "year", year: Number(period.key.slice(0, 4)) };
  }
  const current = currentMonthKey();
  const key = current.startsWith(String(period.year)) ? current : `${period.year}-01`;
  return { kind: "month", key };
}

export function periodQuery(period: Period): Record<string, string> {
  if (period.kind === "month") return { month: period.key };
  if (period.year !== currentYear()) return { year: String(period.year) };
  return {};
}

export function monthKeyOfPeriod(period: Period) {
  if (period.kind === "month") return period.key;
  const current = currentMonthKey();
  return current.startsWith(String(period.year)) ? current : `${period.year}-12`;
}

export function withParams(path: string, params: Record<string, string | undefined | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export type DateRange = { from: string; to: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Um período customizado (from/to) só ativa quando as duas datas vêm preenchidas e válidas; caso
 * contrário a busca continua usando o seletor de Mês/Ano normalmente. */
export function parseDateRange(searchParams?: { from?: string; to?: string }): DateRange | null {
  const from = searchParams?.from;
  const to = searchParams?.to;
  if (from && to && DATE_PATTERN.test(from) && DATE_PATTERN.test(to) && from <= to) {
    return { from, to };
  }
  return null;
}

export function dateRangeToRange(dateRange: DateRange) {
  const [fy, fm, fd] = dateRange.from.split("-").map(Number);
  const [ty, tm, td] = dateRange.to.split("-").map(Number);
  return {
    start: new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0)),
    end: new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59, 999))
  };
}

function formatBr(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function dateRangeLabel(dateRange: DateRange) {
  return `${formatBr(dateRange.from)} a ${formatBr(dateRange.to)}`;
}

export function dateRangeQuery(dateRange: DateRange | null): Record<string, string> {
  return dateRange ? { from: dateRange.from, to: dateRange.to } : {};
}

/** Range efetivo de consulta: o período customizado (from/to), quando ativo, sempre vence o Mês/Ano. */
export function effectiveRange(period: Period, dateRange: DateRange | null) {
  return dateRange ? dateRangeToRange(dateRange) : periodRange(period);
}

export function effectiveRangeLabel(period: Period, dateRange: DateRange | null) {
  return dateRange ? dateRangeLabel(dateRange) : periodLabel(period);
}

/** Complemento para títulos: "de setembro 2026", "do ano de 2026", "de 01/09/2026 a 15/09/2026". */
export function effectiveRangePhrase(period: Period, dateRange: DateRange | null) {
  const label = effectiveRangeLabel(period, dateRange).toLowerCase();
  return !dateRange && period.kind !== "month" ? `do ${label}` : `de ${label}`;
}
