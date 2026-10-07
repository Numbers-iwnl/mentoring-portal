"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Loader2, Save, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type SaveState = "idle" | "saving" | "saved" | "error";

const statusCopy: Record<SaveState, string> = {
  idle: "Salve para recalcular os indicadores desta área.",
  saving: "Salvando sem recarregar a página...",
  saved: "Salvo. Os indicadores foram atualizados.",
  error: "Não foi possível salvar agora. Revise os campos e tente novamente."
};

export function CostSaveForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();
  const isSaving = saveState === "saving";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    setSaveState("saving");

    try {
      const response = await fetch("/api/app/costs?format=json", {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const responseText = await response.text();
      const payload = parseSaveResponse(responseText);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? `HTTP ${response.status}: ${responseText.slice(0, 180) || "sem resposta do servidor"}`);
      }

      setErrorMessage(null);
      setSaveState("saved");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to save cost form", error);
      setErrorMessage(error instanceof Error ? error.message : null);
      setSaveState("error");
    }
  }

  function handleInput() {
    if (saveState === "saved" || saveState === "error") {
      setErrorMessage(null);
      setSaveState("idle");
    }
  }

  return (
    <form action="/api/app/costs" method="post" onInput={handleInput} onSubmit={handleSubmit} className="grid gap-5">
      {children}

      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-lg border border-graphite-950/10 bg-[rgba(255,255,255,0.92)] p-3 shadow-luxury backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-graphite-700">
          {saveState === "saving" || isRefreshing ? (
            <Loader2 className="shrink-0 animate-spin text-champagne-700" size={17} />
          ) : saveState === "saved" ? (
            <CheckCircle2 className="shrink-0 text-emerald-700" size={17} />
          ) : saveState === "error" ? (
            <TriangleAlert className="shrink-0 text-red-800" size={17} />
          ) : null}
          <span className="min-w-0">
            {isRefreshing
              ? "Atualizando os cálculos na tela..."
              : saveState === "error" && errorMessage
                ? `Erro técnico: ${errorMessage}`
                : statusCopy[saveState]}
          </span>
        </div>
        <Button type="submit" disabled={isSaving} className="w-full md:w-auto">
          {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {isSaving ? "Salvando..." : "Salvar custo/hora"}
        </Button>
      </div>
    </form>
  );
}

function parseSaveResponse(text: string) {
  if (!text) return null;

  try {
    return JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    return null;
  }
}
