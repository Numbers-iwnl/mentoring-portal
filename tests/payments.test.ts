import { describe, expect, it } from "vitest";
import {
  expandReceipts,
  legacyColumnsFromPayments,
  paymentsMatchTotal,
  paymentsSum,
  paymentsSummary,
  projectionByMonth,
  readStoredPayments,
  receiptsInRange,
  validatePayments,
  type PaymentForm
} from "../lib/payments";

const avista: PaymentForm = { method: "PIX", amount: 5000, installments: 1, firstDate: "2026-05-09" };
const parcelado: PaymentForm = { method: "Cartão de Crédito", amount: 5000, installments: 5, firstDate: "2026-05-09" };

describe("payments validation", () => {
  it("accepts a valid split in two forms", () => {
    const result = validatePayments([avista, parcelado]);
    expect("payments" in result && result.payments).toHaveLength(2);
  });

  it("rejects more than two forms", () => {
    const result = validatePayments([avista, avista, avista]);
    expect("error" in result && result.error).toContain("máximo 2");
  });

  it("rejects installments on à-vista methods", () => {
    const result = validatePayments([{ ...avista, installments: 3 }]);
    expect("error" in result && result.error).toContain("não permite parcelamento");
  });

  it("rejects zero amounts and bad dates", () => {
    expect("error" in validatePayments([{ ...avista, amount: 0 }])).toBe(true);
    expect("error" in validatePayments([{ ...avista, firstDate: "09/05/2026" }])).toBe(true);
  });

  it("checks totals with 2-decimal tolerance", () => {
    expect(paymentsMatchTotal([avista, parcelado], 10000)).toBe(true);
    expect(paymentsMatchTotal([avista, parcelado], 10001)).toBe(false);
    expect(paymentsSum([avista, parcelado])).toBe(10000);
  });
});

describe("receipt expansion", () => {
  it("expands monthly installments starting at the first date", () => {
    const receipts = expandReceipts([parcelado]);
    expect(receipts).toHaveLength(5);
    expect(receipts.map((r) => r.monthKey)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(receipts.every((r) => r.amount === 1000)).toBe(true);
  });

  it("puts the rounding remainder in the first parcel", () => {
    const receipts = expandReceipts([{ method: "Boleto Bancário", amount: 1000, installments: 3, firstDate: "2026-01-15" }]);
    expect(receipts.map((r) => r.amount)).toEqual([333.34, 333.33, 333.33]);
    expect(Math.round(receipts.reduce((s, r) => s + r.amount, 0) * 100) / 100).toBe(1000);
  });

  it("clamps end-of-month dates instead of overflowing", () => {
    const receipts = expandReceipts([{ method: "Cheque", amount: 300, installments: 3, firstDate: "2026-01-31" }]);
    expect(receipts.map((r) => r.dueDate.toISOString().slice(0, 10))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("sums receipts inside a range (faturamento estimado)", () => {
    const june = receiptsInRange([avista, parcelado], new Date(Date.UTC(2026, 5, 1)), new Date(Date.UTC(2026, 5, 30, 23, 59, 59)));
    expect(june).toBe(1000);
    const may = receiptsInRange([avista, parcelado], new Date(Date.UTC(2026, 4, 1)), new Date(Date.UTC(2026, 4, 31, 23, 59, 59)));
    expect(may).toBe(6000);
  });

  it("projects month by month for the form strip", () => {
    const projection = projectionByMonth([avista, parcelado]);
    expect(projection.get("2026-05")).toBe(6000);
    expect(projection.get("2026-09")).toBe(1000);
  });
});

describe("storage and summaries", () => {
  it("round-trips through stored JSON shape", () => {
    expect(readStoredPayments({ version: 1, forms: [avista] })).toEqual([avista]);
    expect(readStoredPayments(null)).toBeNull();
    expect(readStoredPayments({ version: 1, forms: [] })).toBeNull();
  });

  it("builds a readable summary", () => {
    const summary = paymentsSummary([avista, parcelado]);
    expect(summary).toContain("PIX");
    expect(summary).toContain("5x");
  });

  it("maps methods onto legacy columns", () => {
    const columns = legacyColumnsFromPayments([
      avista,
      parcelado,
      { method: "Boleto Bancário", amount: 200, installments: 2, firstDate: "2026-05-01" }
    ]);
    expect(columns).toEqual({ cash: 0, pix: 5000, card: 5000, transfer: 0 });
  });
});
