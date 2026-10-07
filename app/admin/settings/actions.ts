"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/guards";
import {
  getPortalOptions,
  isPortalOptionKind,
  sanitizePortalOption,
  savePortalOptions,
  MAX_PORTAL_OPTIONS,
  PORTAL_OPTION_DEFAULTS
} from "@/lib/portal-options";

function revalidateOptionPages() {
  revalidatePath("/admin/settings");
  revalidatePath("/app/financeiro");
  revalidatePath("/app/mensagens");
}

export async function addPortalOption(formData: FormData) {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") || "");
  if (!isPortalOptionKind(kind)) redirect("/admin/settings");

  const option = sanitizePortalOption(formData.get("option"));
  if (!option) redirect("/admin/settings");

  const current = await getPortalOptions(kind);
  if (current.length >= MAX_PORTAL_OPTIONS) redirect("/admin/settings?error=limite");
  const next = await savePortalOptions(kind, [...current, option]);

  await writeAudit({
    userId: admin.id,
    action: "portalOptions.add",
    entity: "AppSetting",
    entityId: kind,
    metadata: { option, total: next.length }
  });

  revalidateOptionPages();
  redirect("/admin/settings?saved=1");
}

export async function removePortalOption(formData: FormData) {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") || "");
  if (!isPortalOptionKind(kind)) redirect("/admin/settings");

  const option = sanitizePortalOption(formData.get("option"));
  const current = await getPortalOptions(kind);
  const next = current.filter((item) => item.toLocaleLowerCase("pt-BR") !== option.toLocaleLowerCase("pt-BR"));

  if (!next.length) redirect("/admin/settings?error=ultima");
  await savePortalOptions(kind, next);

  await writeAudit({
    userId: admin.id,
    action: "portalOptions.remove",
    entity: "AppSetting",
    entityId: kind,
    metadata: { option, total: next.length }
  });

  revalidateOptionPages();
  redirect("/admin/settings?saved=1");
}

export async function restorePortalOptionDefaults(formData: FormData) {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") || "");
  if (!isPortalOptionKind(kind)) redirect("/admin/settings");

  await savePortalOptions(kind, [...PORTAL_OPTION_DEFAULTS[kind]]);

  await writeAudit({
    userId: admin.id,
    action: "portalOptions.restore",
    entity: "AppSetting",
    entityId: kind
  });

  revalidateOptionPages();
  redirect("/admin/settings?saved=1");
}
