import { describe, expect, it } from "vitest";
import { sanitizeProfessionalList, sanitizeProfessionalName } from "../lib/professionals";
import { monthLabelFromKey } from "../lib/dashboard";

describe("professionals sanitization", () => {
  it("trims, collapses spaces and limits length", () => {
    expect(sanitizeProfessionalName("  Dra   Ana\tSouza  ")).toBe("Dra Ana Souza");
    expect(sanitizeProfessionalName("a".repeat(200))).toHaveLength(80);
    expect(sanitizeProfessionalName(null)).toBe("");
  });

  it("deduplicates case-insensitively keeping first spelling", () => {
    expect(sanitizeProfessionalList(["Dra Ana", "dra ana", "DRA ANA", "Dr Bruno"])).toEqual(["Dra Ana", "Dr Bruno"]);
  });

  it("drops empty entries", () => {
    expect(sanitizeProfessionalList(["", "  ", "Dra Ana"])).toEqual(["Dra Ana"]);
  });
});

describe("month label", () => {
  it("renders pt-BR month abbreviations", () => {
    expect(monthLabelFromKey("2026-06")).toBe("Jun/26");
    expect(monthLabelFromKey("2026-01")).toBe("Jan/26");
    expect(monthLabelFromKey("2026-12")).toBe("Dez/26");
  });

  it("falls back to the raw key when unparseable", () => {
    expect(monthLabelFromKey("garbage")).toBe("garbage");
  });
});
