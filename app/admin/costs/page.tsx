import { Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateClinicCosts, getClinicCostData } from "@/lib/clinic-costs";
import { formatCurrency, formatNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { studentUnitLabel } from "@/lib/student-units";

export default async function AdminCostsPage() {
  await requireAdmin();

  const activeUnits = await prisma.studentUnit.findMany({
    where: { active: true, student: { active: true } },
    include: { student: true },
    orderBy: { name: "asc" }
  });

  const rows = (await Promise.all(
    activeUnits.map(async (unit) => ({
      unit,
      metrics: calculateClinicCosts(await getClinicCostData(unit.id))
    }))
  )).sort((a, b) => a.unit.student.name.localeCompare(b.unit.student.name));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Custo/hora</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Custo/hora por área</h1>
          <p className="mt-2 max-w-2xl text-sm text-graphite-700/75">
            Custos operacionais mensais preenchidos por cada área e o custo por hora calculado.
          </p>
        </div>
        <ButtonLink href="/api/exports/costs?format=xlsx" variant="secondary">
          <Download size={16} />
          Exportar
        </ButtonLink>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Áreas cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table min-w-[980px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Mentorado</th>
                <th>Área</th>
                <th className="text-right">Despesas mensais (fixas + variáveis)</th>
                <th className="text-right">Investimentos</th>
                <th className="text-right">Horas/mês</th>
                <th className="text-right">Horas com desconto</th>
                <th className="text-right">Custo/hora</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ unit, metrics }) => (
                <tr key={unit.id}>
                  <td className="py-3 font-medium">{unit.student.name}</td>
                  <td>{studentUnitLabel(unit)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(metrics.operatingExpenses)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(metrics.investments)}</td>
                  <td className="text-right tabular-nums">{formatNumber(metrics.monthlyRoomHours)}</td>
                  <td className="text-right tabular-nums">{formatNumber(metrics.discountedHours)}</td>
                  <td className="text-right font-semibold tabular-nums">{formatCurrency(metrics.costPerHour)}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="py-4 text-graphite-700/65" colSpan={7}>
                    Nenhuma área cadastrada ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
