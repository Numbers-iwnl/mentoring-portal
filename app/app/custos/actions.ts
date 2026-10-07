"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { writeAudit } from "@/lib/audit";
import { authOptions } from "@/lib/auth";
import { saveClinicCostForm } from "@/lib/clinic-costs";
import { requireStudentAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { requireSubmittedStudentUnit, withArea } from "@/lib/student-units";

type CostSaveResult = {
  ok: boolean;
  error?: string;
};

export async function updateClinicCosts(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");

  const unit = await requireSubmittedStudentUnit(studentId, formData, "/app/custos");

  let status: "saved" | "saveError" = "saved";
  try {
    await persistClinicCosts(unit.id, formData);
    await auditClinicCostsUpdate(user.id, studentId, unit.id);

    revalidatePath("/app/custos");
    revalidatePath("/admin/costs");
  } catch (error) {
    console.error("Failed to save cost form", error);
    status = "saveError";
  }

  redirectWithStatus(unit.id, status);
}

export async function saveClinicCostsInline(formData: FormData): Promise<CostSaveResult> {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user?.id) {
      return { ok: false, error: "Sessão expirada. Faça login novamente." };
    }

    if (user.role !== "STUDENT" || !user.studentId) {
      return { ok: false, error: "Use um login de aluno para salvar o custo/hora." };
    }

    const studentId = user.studentId;
    const unitId = String(formData.get("unitId") || "");
    const unit = await prisma.studentUnit.findFirst({
      where: {
        id: unitId,
        studentId,
        active: true
      },
      select: { id: true }
    });

    if (!unit) {
      return { ok: false, error: "Área inválida. Recarregue a página e tente novamente." };
    }

    await persistClinicCosts(unit.id, formData);
    await auditClinicCostsUpdate(user.id, studentId, unit.id);

    revalidatePath("/app/custos");
    revalidatePath("/admin/costs");

    return { ok: true };
  } catch (error) {
    console.error("Failed to save cost form", error);
    return { ok: false, error: readableActionError(error) };
  }
}

async function persistClinicCosts(unitId: string, formData: FormData) {
  await saveClinicCostForm(unitId, formData);
}

async function auditClinicCostsUpdate(userId: string, studentId: string, unitId: string) {
  await writeAudit({
    userId,
    studentId,
    action: "clinicCosts.update",
    entity: "StudentUnit",
    entityId: unitId,
    metadata: { unitId }
  });
}

function readableActionError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 220);
  }

  return "Não foi possível salvar agora.";
}

function redirectWithStatus(unitId: string, status: "saved" | "saveError") {
  const params = new URLSearchParams({ area: unitId, [status]: "1" });
  redirect(`/app/custos?${params.toString()}`);
}
