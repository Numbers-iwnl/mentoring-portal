import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/** Brand mark: three arcs rising from a horizon. */
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="brand-mark" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0" stopColor="#98B2C4" />
          <stop offset="1" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>
      <path d="M6 30a14 14 0 0 1 28 0" fill="none" stroke="url(#brand-mark)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 30a9 9 0 0 1 18 0" fill="none" stroke="url(#brand-mark)" strokeWidth="2.6" strokeLinecap="round" opacity=".8" />
      <path d="M16 30a4 4 0 0 1 8 0" fill="none" stroke="url(#brand-mark)" strokeWidth="2.6" strokeLinecap="round" opacity=".6" />
      <path d="M4 33h32" stroke="#98B2C4" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)} aria-label={APP_NAME}>
        <Mark className="h-9 w-9" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5 text-white", className)} aria-label={APP_NAME}>
      <Mark className="h-9 w-9 shrink-0" />
      <span className="font-display text-lg leading-none tracking-wide sm:text-xl">{APP_NAME}</span>
    </div>
  );
}
