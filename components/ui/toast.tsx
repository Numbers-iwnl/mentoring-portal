"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

const variants: Record<ToastVariant, { box: string; icon: React.ReactNode }> = {
  success: {
    box: "border-emerald-700/15 bg-white text-emerald-950 before:bg-emerald-500",
    icon: <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
  },
  error: {
    box: "border-red-900/15 bg-white text-red-950 before:bg-red-500",
    icon: <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
  },
  info: {
    box: "border-champagne-500/30 bg-white text-graphite-800 before:bg-champagne-500",
    icon: <Info size={16} className="mt-0.5 shrink-0 text-champagne-700" />
  }
};

/**
 * Aviso flutuante de resultado de uma ação (salvo/erro) — fica fixo na tela, sempre visível,
 * em vez de inline no topo da página (que só aparece se o usuário estiver rolado até lá).
 * Renderiza via portal para <body> para não herdar posição/overflow de nenhum ancestral.
 */
export function Toast({ variant = "info", children }: { variant?: ToastVariant; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  useEffect(() => setOpen(true), [children]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:top-6">
      <div
        role="status"
        className={cn(
          "pointer-events-auto relative flex w-full max-w-xl items-start gap-2.5 overflow-hidden rounded-lg border py-3 pl-5 pr-10 text-sm font-medium shadow-luxury",
          "before:absolute before:inset-y-0 before:left-0 before:w-1",
          variants[variant].box
        )}
      >
        {variants[variant].icon}
        <div className="min-w-0 flex-1">{children}</div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar aviso"
          className="absolute right-2.5 top-2.5 rounded-md p-1 text-graphite-700/45 transition hover:bg-graphite-950/5 hover:text-graphite-900"
        >
          <X size={14} />
        </button>
      </div>
    </div>,
    document.body
  );
}
