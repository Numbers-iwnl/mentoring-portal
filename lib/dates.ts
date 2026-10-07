import { endOfMonth, format, startOfMonth } from "date-fns";
import { MONTH_LABELS } from "./constants";

export function dateFromInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function inputDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function monthKey(date: Date) {
  return format(date, "yyyy-MM");
}

export function monthLabel(date: Date) {
  return `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function weekOfMonth(date: Date) {
  const day = date.getUTCDate();
  return Math.min(5, Math.floor((day - 1) / 7) + 1);
}

export function weekLabel(date: Date) {
  const week = weekOfMonth(date);
  const startDay = (week - 1) * 7 + 1;
  const monthEnd = daysInUtcMonth(date.getUTCFullYear(), date.getUTCMonth());
  const endDay = week === 5 ? monthEnd : Math.min(startDay + 6, monthEnd);
  return `Semana ${week} - ${String(startDay).padStart(2, "0")} a ${String(endDay).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInUtcMonth(year: number, zeroBasedMonth: number) {
  return new Date(Date.UTC(year, zeroBasedMonth + 1, 0)).getUTCDate();
}

export function currentMonthRange() {
  const now = new Date();
  return {
    start: startOfMonth(now),
    end: endOfMonth(now)
  };
}

export function yearRange(year = new Date().getUTCFullYear()) {
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59))
  };
}
