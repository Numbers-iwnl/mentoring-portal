import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "warn" | "ok" | "neutral" | "danger";

const variants: Record<BadgeVariant, { pill: string; dot: string }> = {
  warn: { pill: "border-amber-600/25 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  ok: { pill: "border-emerald-700/20 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500" },
  neutral: { pill: "border-champagne-500/35 bg-champagne-100 text-graphite-800", dot: "bg-champagne-500" },
  danger: { pill: "border-red-900/20 bg-red-50 text-red-900", dot: "bg-red-500" }
};

export function Badge({
  className,
  variant = "warn",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold",
        variants[variant].pill,
        className
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", variants[variant].dot)} aria-hidden="true" />
      {children}
    </span>
  );
}
