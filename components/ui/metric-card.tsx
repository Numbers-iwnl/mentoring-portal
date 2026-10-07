import { HelpCircle } from "lucide-react";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  detail,
  negativeDetail,
  hint,
  hintAlign = "end"
}: {
  label: string;
  value: string;
  /** Short data line kept visible under the value (e.g. "3 vendas"). */
  detail?: string;
  /** Second data line in a warning tone, for a value that subtracts from the main one (e.g. "− R$ 120,00 estornado"). */
  negativeDetail?: string;
  /** Explanatory legend, tucked behind the "?" tooltip to keep the card clean. */
  hint?: string;
  /**
   * Direction the "?" tooltip opens. "end" (default) opens to the left; use
   * "start" for the leftmost card in a row so it opens rightward into the page
   * instead of clipping behind the sidebar on narrow screens.
   */
  hintAlign?: "start" | "end";
}) {
  return (
    <Card className="value-card">
      <div className="h-[2px] rounded-t-xl bg-gradient-to-r from-[#607889] via-[#98b2c4] to-transparent" aria-hidden="true" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-champagne-700">{label}</p>
          {hint ? (
            <span className="group relative -mr-1 -mt-1 shrink-0">
              <button
                type="button"
                aria-label={`Sobre ${label}`}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-graphite-700/40 transition hover:text-champagne-700 focus:outline-none focus:ring-2 focus:ring-champagne-500/30"
              >
                <HelpCircle size={14} />
              </button>
              <span
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute top-full z-30 mt-1 hidden w-[min(15rem,calc(100vw-2rem))] rounded-md border border-white/10 bg-graphite-850 p-3 text-left text-xs font-medium normal-case leading-5 tracking-normal text-ivory/90 shadow-luxury group-hover:block group-focus-within:block",
                  hintAlign === "start" ? "left-0" : "right-0"
                )}
              >
                {hint}
              </span>
            </span>
          ) : null}
        </div>
        <p className="value-fit mt-2 font-semibold tracking-normal text-ink">{value}</p>
        {detail ? <p className="mt-1 text-sm text-graphite-700/70">{detail}</p> : null}
        {negativeDetail ? <p className="mt-1 text-sm font-semibold text-red-900/80">{negativeDetail}</p> : null}
      </CardContent>
    </Card>
  );
}
