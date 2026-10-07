import { NextResponse } from "next/server";
import { calculateClinicCosts, getClinicCostData } from "@/lib/clinic-costs";
import { rowsToCsv, rowsToXlsxBuffer, type ExportColumn } from "@/lib/export";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { studentUnitLabel } from "@/lib/student-units";

const COLUMNS: ExportColumn[] = [
  { header: "Cliente", key: "student", width: 24 },
  { header: "Área", key: "area", width: 18 },
  { header: "Despesas mensais (fixas + variáveis)", key: "operating", type: "currency", width: 30 },
  { header: "Investimentos", key: "investments", type: "currency" },
  { header: "Horas/semana", key: "weeklyHours", type: "number" },
  { header: "Horas/mês", key: "monthlyHours", type: "number" },
  { header: "Horas com desconto", key: "discountedHours", type: "number" },
  { header: "Custo/hora", key: "costPerHour", type: "currency" }
];

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "xlsx";
  const selectedStudentId = user.role === "ADMIN" ? url.searchParams.get("studentId") ?? undefined : user.studentId ?? "__none__";
  const selectedUnitId = url.searchParams.get("unitId") ?? undefined;

  const where = {
    active: true,
    student: { active: true },
    ...(selectedStudentId ? { studentId: selectedStudentId } : {}),
    ...(selectedUnitId ? { id: selectedUnitId } : {})
  };

  const units = await prisma.studentUnit.findMany({
    where,
    include: { student: true }
  });

  const rows = await Promise.all(
    units.map(async (unit) => {
      const metrics = calculateClinicCosts(await getClinicCostData(unit.id));
      return {
        student: unit.student.name,
        area: studentUnitLabel(unit),
        operating: metrics.operatingExpenses,
        investments: metrics.investments,
        weeklyHours: metrics.weeklyRoomHours,
        monthlyHours: metrics.monthlyRoomHours,
        discountedHours: metrics.discountedHours,
        costPerHour: metrics.costPerHour
      };
    })
  );

  if (format === "csv") {
    return new NextResponse(rowsToCsv(rows, COLUMNS), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=custo-hora.csv"
      }
    });
  }

  const buffer = await rowsToXlsxBuffer("Custo Hora", rows, COLUMNS);
  return new NextResponse(buffer as BodyInit, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=custo-hora.xlsx"
    }
  });
}
