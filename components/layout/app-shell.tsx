import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { ScrollRestore } from "@/components/ui/scroll-restore";
import { Brand } from "./brand";
import { MobileNav, SidebarNav } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

export function AppShell({
  children,
  mode,
  userName,
  subtitle,
  staffSections
}: {
  children: React.ReactNode;
  mode: "student" | "admin" | "staff";
  userName: string;
  subtitle?: string;
  staffSections?: string[];
}) {
  return (
    <div className="min-h-screen bg-graphite-950">
      <aside className="premium-shell fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-white/10 p-4 text-ivory lg:flex">
        <div className="shrink-0 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3">
          <Brand className="justify-center" />
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <SidebarNav mode={mode} staffSections={staffSections} />
        </div>
        <div className="mt-4 shrink-0 rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-luxury">
          <p className="truncate text-sm font-semibold">{userName}</p>
          <p className="mt-1 text-xs text-ivory/55">
            {subtitle ?? (mode === "admin" ? "Administração" : mode === "staff" ? "Acesso da equipe" : "Portal do mentorado")}
          </p>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <header className="premium-shell sticky top-0 z-10 border-b border-white/10 px-4 py-3 text-ivory lg:hidden">
        <div className="flex items-center justify-between">
          <Brand compact />
          <SignOutButton />
        </div>
        <MobileNav mode={mode} staffSections={staffSections} />
      </header>
      <main className="min-h-screen bg-ivory lg:ml-72 lg:rounded-l-3xl lg:border-l lg:border-white/10">
        <div className="surface-grid min-h-screen lg:rounded-l-3xl">
          <div className="page-fade mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </div>
      </main>
      <AssistantWidget />
      <ScrollRestore />
    </div>
  );
}
