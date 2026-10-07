import { describe, expect, it } from "vitest";
import { buildDashboardMetrics } from "../lib/dashboard";

const student = { name: "Histórico Aurora" };

describe("dashboard metrics", () => {
  it("recomputes June week 3 messages from real dates instead of spreadsheet Admin cells", () => {
    const metrics = buildDashboardMetrics(
      [],
      [
        { date: new Date(Date.UTC(2025, 5, 17, 12)), scheduled: true, status: "Finalizado", student },
        { date: new Date(Date.UTC(2025, 5, 18, 12)), scheduled: true, status: "Finalizado", student },
        { date: new Date(Date.UTC(2025, 5, 8, 12)), scheduled: false, status: "Pendente", student }
      ] as never,
      1
    );

    expect(metrics.scheduled).toBe(2);
    expect(metrics.notScheduled).toBe(1);
    expect(metrics.conversionRate).toBeCloseTo(2 / 3);
  });

  it("flags finance entries whose total differs from payment methods", () => {
    const metrics = buildDashboardMetrics(
      [
        {
          date: new Date(Date.UTC(2025, 4, 22, 12)),
          total: { toNumber: () => 2640 },
          cash: { toNumber: () => 0 },
          pix: { toNumber: () => 0 },
          card: { toNumber: () => 264 },
          transfer: { toNumber: () => 0 },
          student
        }
      ] as never,
      [],
      1
    );

    expect(metrics.financeAlerts).toHaveLength(1);
  });
});
