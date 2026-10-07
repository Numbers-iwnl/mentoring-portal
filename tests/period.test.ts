import { describe, expect, it } from "vitest";
import {
  dateRangeLabel,
  dateRangeToRange,
  effectiveRange,
  effectiveRangeLabel,
  parseDateRange,
  parsePeriod,
  periodLabel,
  periodQuery,
  periodRange,
  shiftPeriod,
  togglePeriodKind
} from "../lib/period";

describe("period parsing", () => {
  it("parses a valid month key", () => {
    expect(parsePeriod({ month: "2026-07" })).toEqual({ kind: "month", key: "2026-07" });
  });

  it("rejects malformed month keys and falls back to current year", () => {
    const period = parsePeriod({ month: "2026-13" });
    expect(period.kind).toBe("year");
  });

  it("parses an explicit year", () => {
    expect(parsePeriod({ year: "2025" })).toEqual({ kind: "year", year: 2025 });
  });
});

describe("period range", () => {
  it("covers a whole month in UTC", () => {
    const range = periodRange({ kind: "month", key: "2026-02" });
    expect(range.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });

  it("covers a whole year", () => {
    const range = periodRange({ kind: "year", year: 2026 });
    expect(range.start.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(range.end.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});

describe("period navigation", () => {
  it("shifts months across year boundaries", () => {
    expect(shiftPeriod({ kind: "month", key: "2026-01" }, -1)).toEqual({ kind: "month", key: "2025-12" });
    expect(shiftPeriod({ kind: "month", key: "2026-12" }, 1)).toEqual({ kind: "month", key: "2027-01" });
  });

  it("shifts years", () => {
    expect(shiftPeriod({ kind: "year", year: 2026 }, 1)).toEqual({ kind: "year", year: 2027 });
  });

  it("toggles month back to its year", () => {
    expect(togglePeriodKind({ kind: "month", key: "2025-04" })).toEqual({ kind: "year", year: 2025 });
  });
});

describe("period labels and query", () => {
  it("labels months in pt-BR", () => {
    expect(periodLabel({ kind: "month", key: "2026-07" })).toBe("Julho 2026");
    expect(periodLabel({ kind: "year", year: 2026 })).toBe("Ano de 2026");
  });

  it("serializes month periods to query params", () => {
    expect(periodQuery({ kind: "month", key: "2026-07" })).toEqual({ month: "2026-07" });
  });
});

describe("custom date range", () => {
  it("parses a valid from/to pair", () => {
    expect(parseDateRange({ from: "2026-07-05", to: "2026-07-12" })).toEqual({ from: "2026-07-05", to: "2026-07-12" });
  });

  it("rejects an incomplete or inverted range", () => {
    expect(parseDateRange({ from: "2026-07-05" })).toBeNull();
    expect(parseDateRange({ to: "2026-07-12" })).toBeNull();
    expect(parseDateRange({ from: "2026-07-12", to: "2026-07-05" })).toBeNull();
    expect(parseDateRange({ from: "not-a-date", to: "2026-07-12" })).toBeNull();
  });

  it("covers the full day span in UTC", () => {
    const range = dateRangeToRange({ from: "2026-07-05", to: "2026-07-12" });
    expect(range.start.toISOString()).toBe("2026-07-05T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-12T23:59:59.999Z");
  });

  it("labels the range in pt-BR", () => {
    expect(dateRangeLabel({ from: "2026-07-05", to: "2026-07-12" })).toBe("05/07/2026 a 12/07/2026");
  });

  it("effectiveRange prefers the custom range over the period when both are present", () => {
    const period = { kind: "month" as const, key: "2026-01" };
    const dateRange = { from: "2026-07-05", to: "2026-07-12" };
    expect(effectiveRange(period, dateRange)).toEqual(dateRangeToRange(dateRange));
    expect(effectiveRange(period, null)).toEqual(periodRange(period));
  });

  it("effectiveRangeLabel falls back to the period label when no custom range is set", () => {
    const period = { kind: "month" as const, key: "2026-07" };
    expect(effectiveRangeLabel(period, null)).toBe("Julho 2026");
    expect(effectiveRangeLabel(period, { from: "2026-07-05", to: "2026-07-12" })).toBe("05/07/2026 a 12/07/2026");
  });
});
