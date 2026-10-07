import { describe, expect, it } from "vitest";
import { calculateClinicCosts } from "../lib/clinic-costs";

const decimal = (value: number) => ({ toNumber: () => value });

describe("clinic cost calculator", () => {
  it("matches the spreadsheet cost-hour logic", () => {
    const metrics = calculateClinicCosts({
      setting: {
        weeksPerMonth: decimal(4),
        idleDiscountPercent: decimal(20)
      },
      expenseItems: [
        { category: "EMPLOYEES", amount: decimal(6000) },
        { category: "STRUCTURE", amount: decimal(1600) },
        { category: "VARIABLE", amount: decimal(400) },
        { category: "INVESTMENT", amount: decimal(2500) }
      ],
      roomHours: [
        {
          monday: decimal(5),
          tuesday: decimal(8),
          wednesday: decimal(8),
          thursday: decimal(8),
          friday: decimal(8),
          saturday: decimal(8),
          sunday: decimal(0)
        },
        {
          monday: decimal(10),
          tuesday: decimal(8),
          wednesday: decimal(8),
          thursday: decimal(8),
          friday: decimal(8),
          saturday: decimal(8),
          sunday: decimal(0)
        }
      ]
    } as never);

    expect(metrics.fixedExpenses).toBe(7600);
    expect(metrics.variableExpenses).toBe(400);
    expect(metrics.operatingExpenses).toBe(8000);
    expect(metrics.investments).toBe(2500);
    expect(metrics.weeklyRoomHours).toBe(95);
    expect(metrics.monthlyRoomHours).toBe(380);
    expect(metrics.discountedHours).toBe(304);
    // Custo/hora = despesas operacionais (fixas + variáveis) / horas com desconto.
    expect(metrics.costPerHour).toBeCloseTo(8000 / 304, 6);
  });
});
