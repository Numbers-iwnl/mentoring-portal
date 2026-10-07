import { AreaSwitcher } from "@/components/student/area-switcher";
import { ClinicCostForm } from "@/components/forms/clinic-cost-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateClinicCosts, getClinicCostData } from "@/lib/clinic-costs";
import { requireStaffSection } from "@/lib/guards";
import { getStudentUnits, selectStudentUnit, studentUnitLabel } from "@/lib/student-units";
import { Toast } from "@/components/ui/toast";

export default async function ClinicCostsPage({ searchParams }: { searchParams?: { area?: string; saved?: string; saveError?: string } }) {
  const { studentId } = await requireStaffSection("custos");
  const units = studentId ? await getStudentUnits(studentId) : [];
  const activeUnit = selectStudentUnit(units, searchParams?.area);

  if (!activeUnit) {
    return (
      <div className="grid gap-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Custo/hora</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Custo/hora da operação</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma área ativa</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-graphite-700">
            Este login ainda não tem uma área de preenchimento ativa. Peça para a administração habilitar Clínica, Mentoria ou Outros no cadastro.
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = await getClinicCostData(activeUnit.id);
  const metrics = calculateClinicCosts(data);

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Custo/hora</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Custo/hora de {studentUnitLabel(activeUnit)}</h1>
          <p className="mt-2 max-w-2xl text-sm text-graphite-700/75">
            Preencha despesas mensais e horas disponíveis para calcular o custo operacional desta área.
          </p>
        </div>
        <AreaSwitcher units={units} activeUnitId={activeUnit.id} basePath="/app/custos" />
      </header>

      {searchParams?.saved ? (
        <Toast variant="success">
          Custo/hora salvo com sucesso.
        </Toast>
      ) : null}
      {searchParams?.saveError ? (
        <Toast variant="error">
          Não foi possível salvar agora. Os dados não foram gravados; tente novamente em alguns segundos.
        </Toast>
      ) : null}

      <ClinicCostForm unitId={activeUnit.id} data={data} metrics={metrics} />
    </div>
  );
}
