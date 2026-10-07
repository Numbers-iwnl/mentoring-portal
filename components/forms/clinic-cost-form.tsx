import { Save } from "lucide-react";
import type { ClinicCostData, ClinicCostMetrics } from "@/lib/clinic-costs";
import {
  CLINIC_EXPENSE_CATEGORY_LABELS,
  CLINIC_EXPENSE_ITEMS,
  CLINIC_ROOM_DAYS,
  FIXED_IDLE_DISCOUNT_PERCENT,
  decimalInput
} from "@/lib/clinic-costs";
import { formatCurrency, formatNumber, toNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

export function ClinicCostForm({
  unitId,
  data,
  metrics
}: {
  unitId: string;
  data: ClinicCostData;
  metrics: ClinicCostMetrics;
}) {
  const itemsByCategory = CLINIC_EXPENSE_ITEMS.reduce<Record<string, typeof data.expenseItems>>((grouped, definition) => {
    grouped[definition.category] = data.expenseItems.filter((item) => item.category === definition.category);
    return grouped;
  }, {});

  return (
    <form action="/api/app/costs" method="post" className="grid gap-5">
      <input type="hidden" name="unitId" value={unitId} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Despesas mensais (fixas + variáveis)" value={formatCurrency(metrics.operatingExpenses)} />
        <SummaryCard label="Investimentos" value={formatCurrency(metrics.investments)} />
        <SummaryCard label="Horas úteis/mês" value={formatNumber(metrics.discountedHours)} />
        <SummaryCard label="Custo/hora" value={formatCurrency(metrics.costPerHour)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros de cálculo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Semanas por mês" editable>
            <Input name="weeksPerMonth" type="number" step="0.01" min="0" defaultValue={decimalInput(data.setting.weeksPerMonth)} />
          </Field>
          <div className="grid gap-1.5 text-sm font-semibold text-graphite-800">
            <span>Desconto por faltas/ociosidade</span>
            <div className="flex h-11 items-center rounded-md border border-graphite-950/10 bg-graphite-950/[0.035] px-3 text-sm text-graphite-700">
              {FIXED_IDLE_DISCOUNT_PERCENT}% fixo
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Despesas mensais da área</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {Object.entries(CLINIC_EXPENSE_CATEGORY_LABELS).map(([category, label]) => {
            const items = itemsByCategory[category] ?? [];
            const total = items.reduce((sum, item) => sum + toNumber(item.amount), 0);
            return (
              <div key={category} className="grid gap-3">
                <div className="flex items-center justify-between border-b border-graphite-950/10 pb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-champagne-700">{label}</h3>
                  <strong className="text-sm text-ink">{formatCurrency(total)}</strong>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => (
                    <Field key={item.id} label={item.label} editable>
                      <Input name={`expense:${item.id}`} type="number" min="0" step="0.01" defaultValue={decimalInput(item.amount)} />
                    </Field>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horas de atendimento por sala/ambiente</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table min-w-[880px] text-left text-sm">
            <thead>
              <tr>
                <th className="w-[15rem] py-2">Sala/ambiente</th>
                {CLINIC_ROOM_DAYS.map((day) => (
                  <th key={day.key}>{day.label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.roomHours.map((room) => {
                const total = CLINIC_ROOM_DAYS.reduce((sum, day) => sum + toNumber(room[day.key]), 0);
                return (
                  <tr key={room.id}>
                    <td className="py-2 pr-2">
                      <Input name={`room:${room.id}:name`} defaultValue={room.roomName} title={room.roomName || undefined} />
                    </td>
                    {CLINIC_ROOM_DAYS.map((day) => (
                      <td key={day.key} className="py-2 pr-2">
                        <Input
                          name={`room:${room.id}:${day.key}`}
                          type="number"
                          min="0"
                          step="0.25"
                          defaultValue={decimalInput(room[day.key])}
                        />
                      </td>
                    ))}
                    <td className="font-semibold">{formatNumber(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 grid gap-2 text-sm text-graphite-700 sm:grid-cols-3">
            <p className="rounded-md bg-graphite-950/[0.035] px-3 py-2">Horas semanais: {formatNumber(metrics.weeklyRoomHours)}</p>
            <p className="rounded-md bg-graphite-950/[0.035] px-3 py-2">Horas mensais: {formatNumber(metrics.monthlyRoomHours)}</p>
            <p className="rounded-md bg-graphite-950/[0.035] px-3 py-2">Horas com desconto: {formatNumber(metrics.discountedHours)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-lg border border-graphite-950/10 bg-[rgba(255,255,255,0.92)] p-3 shadow-luxury backdrop-blur md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-semibold text-graphite-700">Salve para atualizar os indicadores desta área.</p>
        <Button type="submit" className="w-full md:w-auto">
          <Save size={16} />
          Salvar custo/hora
        </Button>
      </div>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="value-card rounded-md border border-graphite-950/10 bg-[rgba(255,255,255,0.88)] p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite-700/55">{label}</p>
      <p className="summary-value-fit mt-2 font-semibold text-ink">{value}</p>
    </div>
  );
}
