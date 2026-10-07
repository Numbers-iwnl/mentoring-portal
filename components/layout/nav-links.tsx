"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calculator,
  ClipboardList,
  History,
  MessageSquare,
  ScrollText,
  Settings,
  UploadCloud,
  UserCircle2,
  Users,
  type LucideIcon
} from "lucide-react";
import { STAFF_SECTIONS, type StaffSection } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const STAFF_SECTION_ICON: Record<StaffSection, LucideIcon> = {
  dashboard: BarChart3,
  financeiro: ClipboardList,
  mensagens: MessageSquare,
  custos: Calculator,
  history: History
};

const CONTA_ITEM: NavItem = { href: "/app/conta", label: "Minha conta", icon: UserCircle2 };

const NAVS: Record<"student" | "admin", { rootHref: string; items: NavItem[] }> = {
  student: {
    rootHref: "/app",
    items: [
      { href: "/app", label: "Visão geral", icon: BarChart3 },
      { href: "/app/financeiro", label: "Vendas", icon: ClipboardList },
      { href: "/app/mensagens", label: "Mensagens", icon: MessageSquare },
      { href: "/app/custos", label: "Custo/hora", icon: Calculator },
      { href: "/app/equipe", label: "Equipe", icon: Users },
      { href: "/app/importacoes", label: "Importações", icon: UploadCloud },
      { href: "/app/history", label: "Histórico", icon: History },
      CONTA_ITEM
    ]
  },
  admin: {
    rootHref: "/admin",
    items: [
      { href: "/admin", label: "Dashboard", icon: BarChart3 },
      { href: "/admin/students", label: "Alunos", icon: Users },
      { href: "/admin/finance", label: "Vendas", icon: ClipboardList },
      { href: "/admin/messages", label: "Mensagens", icon: MessageSquare },
      { href: "/admin/costs", label: "Custo/hora", icon: Calculator },
      { href: "/admin/imports", label: "Importações", icon: History },
      { href: "/admin/audit", label: "Auditoria", icon: ScrollText },
      { href: "/admin/settings", label: "Ajustes", icon: Settings },
      { href: "/admin/conta", label: "Minha conta", icon: UserCircle2 }
    ]
  }
};

/** Builds a funcionário's nav from their granted sections (+ Minha conta always). */
function resolveNav(
  mode: "student" | "admin" | "staff",
  staffSections?: string[]
): { rootHref: string; items: NavItem[] } {
  if (mode !== "staff") return NAVS[mode];
  const allowed = new Set(staffSections ?? []);
  const items: NavItem[] = STAFF_SECTIONS.filter((section) => allowed.has(section.key)).map((section) => ({
    href: section.path,
    label: section.label,
    icon: STAFF_SECTION_ICON[section.key]
  }));
  items.push(CONTA_ITEM);
  return { rootHref: items[0]?.href ?? "/app/conta", items };
}

function isActive(pathname: string, href: string, rootHref: string) {
  if (href === rootHref) return pathname === rootHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ mode, staffSections }: { mode: "student" | "admin" | "staff"; staffSections?: string[] }) {
  const pathname = usePathname();
  const { items, rootHref } = resolveNav(mode, staffSections);
  return (
    <nav className="mt-6 grid gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href, rootHref);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-[rgba(255,255,255,0.12)] text-white shadow-sm before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-champagne-300"
                : "text-ivory/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon size={17} className={active ? "text-champagne-300" : undefined} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ mode, staffSections }: { mode: "student" | "admin" | "staff"; staffSections?: string[] }) {
  const pathname = usePathname();
  const { items, rootHref } = resolveNav(mode, staffSections);
  return (
    <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
      {items.map((item) => {
        const active = isActive(pathname, item.href, rootHref);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition",
              active ? "border-champagne-300/70 bg-[rgba(255,255,255,0.14)] text-white" : "border-white/10 bg-white/5 text-[rgba(245,247,248,0.78)]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
