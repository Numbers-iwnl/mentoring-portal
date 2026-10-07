import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <AppShell mode="admin" userName={user.name ?? "Administração"} subtitle="Visão completa dos mentorados">
      {children}
    </AppShell>
  );
}
