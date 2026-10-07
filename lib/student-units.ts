import { notFound, redirect } from "next/navigation";
import { StudentUnitType, type StudentUnit } from "@prisma/client";
import { prisma } from "./prisma";

export const STUDENT_UNIT_LABELS: Record<StudentUnitType, string> = {
  CLINIC: "Clínica",
  MENTORSHIP: "Mentoria",
  OTHER: "Outros"
};

const STUDENT_UNIT_ORDER: Record<StudentUnitType, number> = {
  CLINIC: 1,
  MENTORSHIP: 2,
  OTHER: 3
};

export function studentUnitLabel(unit?: Pick<StudentUnit, "name" | "type"> | null) {
  if (!unit) return "-";
  return unit.name || STUDENT_UNIT_LABELS[unit.type];
}

export async function getStudentUnits(studentId: string) {
  const units = await prisma.studentUnit.findMany({
    where: { studentId, active: true },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }]
  });
  return sortStudentUnits(units);
}

export function selectStudentUnit(units: StudentUnit[], requestedUnitId?: string | null) {
  if (!units.length) return null;
  const sortedUnits = sortStudentUnits(units);
  return sortedUnits.find((unit) => unit.id === requestedUnitId) ?? sortedUnits[0];
}

export async function requireStudentUnit(studentId: string, requestedUnitId?: string | null) {
  const units = await getStudentUnits(studentId);
  const unit = selectStudentUnit(units, requestedUnitId);
  if (!unit) {
    notFound();
  }
  return unit;
}

export async function requireSubmittedStudentUnit(studentId: string, formData: FormData, redirectPath: string) {
  const unitId = String(formData.get("unitId") || "");
  const unit = await prisma.studentUnit.findFirst({
    where: {
      id: unitId,
      studentId,
      active: true
    }
  });

  if (!unit) {
    const fallback = await prisma.studentUnit.findFirst({
      where: { studentId, active: true },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }]
    });
    if (!fallback) redirect("/app");
    redirect(`${redirectPath}?area=${fallback.id}`);
  }

  return unit;
}

export function withArea(path: string, unitId?: string | null) {
  return unitId ? `${path}?area=${unitId}` : path;
}

export function sortStudentUnits<T extends Pick<StudentUnit, "type" | "createdAt">>(units: T[]) {
  return [...units].sort((a, b) => {
    const typeDiff = STUDENT_UNIT_ORDER[a.type] - STUDENT_UNIT_ORDER[b.type];
    if (typeDiff) return typeDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
