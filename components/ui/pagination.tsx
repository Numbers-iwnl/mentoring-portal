import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE } from "@/lib/pagination";
import { withParams } from "@/lib/period";
import { cn } from "@/lib/utils";

/** Paginação "Anterior/Próxima" com faixa (ex.: "51-100"). Só aparece quando há mais de uma página. */
export function Pagination({
  page,
  count,
  hasNext,
  basePath,
  paramName = "page",
  carryParams = {},
  pageSize = PAGE_SIZE
}: {
  page: number;
  count: number;
  hasNext: boolean;
  basePath: string;
  /** Nome do searchParam a atualizar — permite duas paginações independentes na mesma página (ex.: Histórico). */
  paramName?: string;
  carryParams?: Record<string, string | undefined>;
  pageSize?: number;
}) {
  if (page === 1 && !hasNext) return null;

  const start = count ? (page - 1) * pageSize + 1 : 0;
  const end = start ? start + count - 1 : 0;
  const href = (target: number) => withParams(basePath, { ...carryParams, [paramName]: target > 1 ? String(target) : undefined });

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[rgba(0,6,35,0.08)] pt-3">
      <PageLink href={href(page - 1)} disabled={page <= 1}>
        <ChevronLeft size={14} />
        Anterior
      </PageLink>
      <span className="text-xs font-semibold tabular-nums text-graphite-700/70">{start ? `${start}-${end}` : "-"}</span>
      <PageLink href={href(page + 1)} disabled={!hasNext}>
        Próxima
        <ChevronRight size={14} />
      </PageLink>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md border border-[rgba(0,6,35,0.12)] bg-white px-3 text-xs font-semibold text-graphite-800 shadow-sm transition",
        disabled ? "pointer-events-none opacity-40" : "hover:border-champagne-500 hover:bg-champagne-50"
      )}
    >
      {children}
    </Link>
  );
}
