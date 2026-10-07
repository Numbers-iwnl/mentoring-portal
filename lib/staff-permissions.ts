import type { Prisma } from "@prisma/client";

/**
 * Granular access control for funcionário (STAFF) logins: the admin/mentorado
 * picks exactly which sections of the portal each employee can open. Stored as
 * a JSON string array on User.permissions.
 *
 * Pure module (no prisma/no icons) so it can be imported by both server guards
 * and client components. The DB read lives in lib/guards.ts.
 */
export const STAFF_SECTIONS = [
  { key: "dashboard", label: "Visão geral", path: "/app" },
  { key: "financeiro", label: "Vendas", path: "/app/financeiro" },
  { key: "mensagens", label: "Mensagens", path: "/app/mensagens" },
  { key: "custos", label: "Custo/hora", path: "/app/custos" },
  { key: "history", label: "Histórico", path: "/app/history" }
] as const;

export type StaffSection = (typeof STAFF_SECTIONS)[number]["key"];

const VALID_SECTIONS = new Set<string>(STAFF_SECTIONS.map((s) => s.key));

/** Legacy default for funcionários created before granular permissions existed. */
export const DEFAULT_STAFF_PERMISSIONS: StaffSection[] = ["financeiro", "mensagens"];

export function isStaffSection(value: unknown): value is StaffSection {
  return typeof value === "string" && VALID_SECTIONS.has(value);
}

export function sanitizeStaffPermissions(values: unknown[]): StaffSection[] {
  const seen = new Set<StaffSection>();
  for (const value of values) {
    if (isStaffSection(value)) seen.add(value);
  }
  // Preserve canonical order.
  return STAFF_SECTIONS.map((s) => s.key).filter((key) => seen.has(key));
}

/**
 * Reads stored permissions. `null`/invalid → legacy default (Vendas + Mensagens),
 * so already-live funcionários keep working after the column is added.
 */
export function parseStaffPermissions(value: Prisma.JsonValue | null | undefined): StaffSection[] {
  if (!Array.isArray(value)) return [...DEFAULT_STAFF_PERMISSIONS];
  const parsed = sanitizeStaffPermissions(value);
  return parsed.length ? parsed : [...DEFAULT_STAFF_PERMISSIONS];
}

export function serializeStaffPermissions(sections: StaffSection[]): Prisma.InputJsonValue {
  return sanitizeStaffPermissions(sections);
}

export function sectionPath(section: StaffSection): string {
  return STAFF_SECTIONS.find((s) => s.key === section)?.path ?? "/app/conta";
}

/** Where a funcionário lands after login: their first granted section, else Minha conta. */
export function staffLandingPath(permissions: StaffSection[]): string {
  const first = STAFF_SECTIONS.find((s) => permissions.includes(s.key));
  return first ? first.path : "/app/conta";
}
