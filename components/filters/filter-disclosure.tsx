"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Linha de busca + botão "Filtros" que abre/fecha o painel. O painel fica sempre no formulário
 * (só escondido), então os filtros já escolhidos continuam sendo enviados ao clicar em Buscar.
 */
export function FilterDisclosure({
  activeCount,
  bar,
  submit,
  children
}: {
  activeCount: number;
  bar: React.ReactNode;
  submit: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Não manda campos vazios: a URL fica só com os filtros realmente usados.
  useEffect(() => {
    const form = barRef.current?.closest("form");
    if (!form) return;
    const dropEmpty = (event: FormDataEvent) => {
      for (const [key, value] of [...event.formData.entries()]) {
        if (value === "") event.formData.delete(key);
      }
    };
    form.addEventListener("formdata", dropEmpty);
    return () => form.removeEventListener("formdata", dropEmpty);
  }, []);

  return (
    <>
      <div ref={barRef} className="flex flex-wrap items-center gap-2">
        {bar}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-xs font-semibold text-graphite-800 shadow-sm transition hover:border-champagne-500 hover:bg-champagne-50",
            open || activeCount ? "border-champagne-500" : "border-[rgba(0,6,35,0.12)]"
          )}
        >
          <SlidersHorizontal size={14} />
          Filtros
          {activeCount ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-graphite-950 px-1.5 text-[11px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
          <ChevronDown size={14} className={cn("transition", open ? "rotate-180" : "")} aria-hidden="true" />
        </button>
        {submit}
      </div>
      <div hidden={!open} className="rounded-lg border border-[rgba(0,6,35,0.1)] bg-[rgba(245,247,248,0.7)] p-4">
        {children}
      </div>
    </>
  );
}
