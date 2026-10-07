"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { MULTI_SEPARATOR } from "@/lib/multi-filter";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string };

/**
 * Filtro de múltipla escolha para os formulários de busca (GET). Mostra uma lista com caixinhas;
 * o valor vai num campo escondido, com as escolhas separadas por "|" (ver lib/multi-filter.ts).
 * A escolha só vale ao clicar em Buscar (ou em "Aplicar", aqui dentro) — igual aos outros filtros.
 */
export function MultiSelectFilter({
  name,
  label,
  allLabel,
  options,
  defaultValues = [],
  plain = false,
  className
}: {
  name: string;
  label: string;
  /** Texto quando nada está marcado, ex.: "todas". */
  allLabel: string;
  options: MultiSelectOption[];
  defaultValues?: string[];
  /** Sem o prefixo "Label:" no botão (quando o rótulo já aparece acima do campo). */
  plain?: boolean;
  className?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValues);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Navegação sem recarregar (Limpar filtros, período, paginação) reaproveita o componente:
  // realinha a seleção com o que veio na URL.
  const defaultKey = defaultValues.join(MULTI_SEPARATOR);
  useEffect(() => {
    setSelected(defaultKey ? defaultKey.split(MULTI_SEPARATOR) : []);
  }, [defaultKey]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string) =>
    setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));

  // Mantém a ordem das opções no valor enviado.
  const ordered = options.filter((option) => selected.includes(option.value));
  const summary =
    ordered.length === 0 ? allLabel : ordered.length === 1 ? ordered[0].label : `${ordered.length} selecionados`;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={ordered.map((option) => option.value).join(MULTI_SEPARATOR)} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-[rgba(0,6,35,0.12)] bg-white px-3 text-left text-xs text-ink outline-none transition focus:border-champagne-500 focus:ring-2 focus:ring-[rgba(152,178,196,0.24)]",
          plain ? "h-10 text-sm" : "h-9",
          ordered.length ? "border-champagne-500 font-semibold" : ""
        )}
      >
        <span className="truncate">{plain ? summary : `${label}: ${summary}`}</span>
        <ChevronDown size={14} className="shrink-0 text-graphite-700/60" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-1 w-max min-w-full max-w-[18rem] rounded-md border border-[rgba(0,6,35,0.12)] bg-white p-1 shadow-soft"
        >
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-graphite-700/60">
            Marque uma ou mais
          </p>
          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink hover:bg-[rgba(152,178,196,0.12)]"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked ? "border-graphite-950 bg-graphite-950 text-white" : "border-[rgba(0,6,35,0.25)] bg-white"
                    )}
                    aria-hidden="true"
                  >
                    {checked ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-[rgba(0,6,35,0.08)] px-1 pt-1.5">
            <button
              type="button"
              onClick={() => setSelected([])}
              disabled={!selected.length}
              className="rounded px-2 py-1 text-xs text-graphite-700 hover:bg-[rgba(152,178,196,0.12)] disabled:opacity-40"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                rootRef.current?.closest("form")?.requestSubmit();
              }}
              className="rounded bg-graphite-950 px-3 py-1 text-xs font-semibold text-white hover:bg-graphite-850"
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
