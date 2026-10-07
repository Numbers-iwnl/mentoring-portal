import Link from "next/link";
import { X } from "lucide-react";

/** Só aparece quando há busca ou período de datas customizado ativo — não conta paginação como "filtro". */
export function ClearFiltersLink({ show, href }: { show: boolean; href: string }) {
  if (!show) return null;
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[rgba(0,6,35,0.12)] bg-white px-3 text-xs font-semibold text-graphite-700 shadow-sm transition hover:border-champagne-500 hover:bg-champagne-50"
    >
      <X size={14} />
      Limpar filtros
    </Link>
  );
}
