import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type NoticeVariant = "success" | "error" | "info";

const variants: Record<NoticeVariant, { box: string; icon: React.ReactNode }> = {
  success: {
    box: "border-emerald-700/15 bg-emerald-50/80 text-emerald-950 before:bg-emerald-500",
    icon: <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
  },
  error: {
    box: "border-red-900/15 bg-red-50/80 text-red-950 before:bg-red-500",
    icon: <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
  },
  info: {
    box: "border-champagne-500/30 bg-champagne-100/70 text-graphite-800 before:bg-champagne-500",
    icon: <Info size={16} className="mt-0.5 shrink-0 text-champagne-700" />
  }
};

/** Banner de feedback com acento lateral e ícone, no padrão do design system. */
export function Notice({
  variant = "info",
  className,
  children
}: {
  variant?: NoticeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex items-start gap-2.5 overflow-hidden rounded-lg border py-3 pl-5 pr-4 text-sm font-medium shadow-sm",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        variants[variant].box,
        className
      )}
    >
      {variants[variant].icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
