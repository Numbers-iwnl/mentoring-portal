import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const GOALS_PREFIX = "goals:";

function goalKey(unitId: string) {
  return `${GOALS_PREFIX}${unitId}`;
}

function parseGoalValue(value: Prisma.JsonValue | undefined): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const target = (value as Record<string, unknown>).monthlyRevenueTarget;
  return typeof target === "number" && Number.isFinite(target) && target > 0 ? target : 0;
}

export async function getUnitGoal(unitId: string): Promise<number> {
  const stored = await prisma.appSetting.findUnique({ where: { key: goalKey(unitId) }, select: { value: true } });
  return parseGoalValue(stored?.value);
}

export async function getUnitGoals(unitIds: string[]): Promise<Map<string, number>> {
  const goals = new Map<string, number>();
  if (!unitIds.length) return goals;
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: unitIds.map(goalKey) } },
    select: { key: true, value: true }
  });
  for (const row of rows) {
    goals.set(row.key.slice(GOALS_PREFIX.length), parseGoalValue(row.value));
  }
  return goals;
}

export async function saveUnitGoal(unitId: string, target: number) {
  const sanitized = Number.isFinite(target) && target > 0 ? Math.min(target, 999999999) : 0;
  const value: Prisma.InputJsonValue = { version: 1, monthlyRevenueTarget: sanitized };
  await prisma.appSetting.upsert({
    where: { key: goalKey(unitId) },
    update: { value },
    create: { key: goalKey(unitId), value }
  });
  return sanitized;
}

export function goalProgress(revenue: number, target: number) {
  if (target <= 0) return 0;
  return revenue / target;
}

/**
 * Pace-aware status: compares progress against how far into the month we are.
 * A goal is "on pace" when the achieved fraction meets the elapsed fraction of the month.
 */
export function goalPaceStatus(revenue: number, target: number, now = new Date()): "hit" | "on-pace" | "behind" {
  if (target <= 0) return "behind";
  if (revenue >= target) return "hit";
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsed = day / daysInMonth;
  return revenue / target >= elapsed * 0.9 ? "on-pace" : "behind";
}
