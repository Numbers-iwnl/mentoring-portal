import { describe, expect, it } from "vitest";
import { isServiceType, serviceTypeDisplay } from "../lib/service-types";

describe("serviceTypeDisplay", () => {
  it("prefers the category when present", () => {
    expect(serviceTypeDisplay("Pilates", "Plano 2x por semana")).toEqual({ text: "Pilates", legacy: false });
  });

  it("falls back to the legacy free text for sales registered before the category existed", () => {
    expect(serviceTypeDisplay(null, "Primeira consulta fisioterapia 2/2")).toEqual({
      text: "Primeira consulta fisioterapia 2/2",
      legacy: true
    });
  });

  it("shows a dash when nothing was filled", () => {
    expect(serviceTypeDisplay(null, null)).toEqual({ text: "-", legacy: false });
  });
});

describe("isServiceType", () => {
  it("accepts only the fixed options", () => {
    expect(isServiceType("Outros")).toBe(true);
    expect(isServiceType("outros")).toBe(false);
    expect(isServiceType("")).toBe(false);
  });
});
