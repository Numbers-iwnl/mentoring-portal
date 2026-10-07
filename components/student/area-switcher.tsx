import Link from "next/link";
import type { StudentUnit } from "@prisma/client";
import { Building2, GraduationCap, Layers3, LayoutGrid } from "lucide-react";
import { withParams } from "@/lib/period";
import { studentUnitLabel } from "@/lib/student-units";
import { cn } from "@/lib/utils";

export function AreaSwitcher({
  units,
  activeUnitId,
  basePath,
  carryParams = {},
  allowAll = false
}: {
  units: StudentUnit[];
  activeUnitId?: string | null;
  basePath: string;
  carryParams?: Record<string, string | undefined>;
  /** Adds a "Visão geral" chip that aggregates every area (active when no unit is selected). */
  allowAll?: boolean;
}) {
  if (!units.length) return null;

  const showAll = allowAll && units.length > 1;

  if (units.length === 1 && !showAll) {
    return (
      <div className="inline-flex items-center gap-3 rounded-md border border-graphite-950/10 bg-[rgba(255,255,255,0.88)] px-3 py-2 text-sm font-semibold text-graphite-800 shadow-sm">
        <AreaIcon type={units[0].type} />
        <span>{studentUnitLabel(units[0])}</span>
      </div>
    );
  }

  const chipClass = (active: boolean) =>
    cn(
      "inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition",
      active
        ? "bg-graphite-950 text-white shadow-sm"
        : "border border-[rgba(0,6,35,0.08)] bg-ivory/70 text-graphite-700 hover:border-champagne-500/50 hover:bg-champagne-100"
    );

  return (
    <div className="grid gap-2 rounded-md border border-graphite-950/10 bg-[rgba(255,255,255,0.88)] p-2 shadow-sm">
      <p className="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-graphite-700/55">Área ativa</p>
      <div className="flex flex-wrap gap-1.5">
        {showAll ? (
          <Link href={withParams(basePath, { ...carryParams, area: undefined })} className={chipClass(!activeUnitId)}>
            <LayoutGrid size={15} />
            Visão geral
          </Link>
        ) : null}
        {units.map((unit) => {
          const active = unit.id === activeUnitId;
          return (
            <Link key={unit.id} href={withParams(basePath, { ...carryParams, area: unit.id })} className={chipClass(active)}>
              <AreaIcon type={unit.type} />
              {studentUnitLabel(unit)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AreaIcon({ type }: { type: StudentUnit["type"] }) {
  const Icon = type === "CLINIC" ? Building2 : type === "MENTORSHIP" ? GraduationCap : Layers3;
  return <Icon size={15} />;
}
