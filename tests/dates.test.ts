import { describe, expect, it } from "vitest";
import { dateFromInput, weekLabel, weekOfMonth } from "../lib/dates";

describe("date rollups", () => {
  it("groups days into spreadsheet-style weeks of month", () => {
    expect(weekOfMonth(dateFromInput("2025-06-01"))).toBe(1);
    expect(weekOfMonth(dateFromInput("2025-06-07"))).toBe(1);
    expect(weekOfMonth(dateFromInput("2025-06-08"))).toBe(2);
    expect(weekOfMonth(dateFromInput("2025-06-17"))).toBe(3);
    expect(weekOfMonth(dateFromInput("2025-06-29"))).toBe(5);
  });

  it("labels week 3 correctly, avoiding the spreadsheet Admin bug", () => {
    expect(weekLabel(dateFromInput("2025-06-17"))).toBe("Semana 3 - 15 a 21/06");
  });
});
