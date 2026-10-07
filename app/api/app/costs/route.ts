import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { writeAudit } from "@/lib/audit";
import { saveClinicCostForm } from "@/lib/clinic-costs";
import { prisma } from "@/lib/prisma";
import { parseStaffPermissions } from "@/lib/staff-permissions";

export async function POST(request: NextRequest) {
  const wantsJson = request.nextUrl.searchParams.get("format") === "json" || (request.headers.get("accept")?.includes("application/json") ?? false);
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const userId = typeof token?.sub === "string" ? token.sub : undefined;

  if (!userId) return errorResponse(wantsJson, "/login", "Sessão expirada. Faça login novamente.", 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      active: true,
      studentId: true,
      permissions: true
    }
  });

  if (!user?.active) return errorResponse(wantsJson, "/login", "Sessão expirada. Faça login novamente.", 401);
  // Funcionário só salva custo/hora se tiver essa permissão marcada.
  if (user.role === "STAFF" && !parseStaffPermissions(user.permissions).includes("custos")) {
    return errorResponse(wantsJson, "/app/custos", "Sem permissão.", 403);
  }

  const formData = await request.formData();
  const unitId = String(formData.get("unitId") || "");
  const unitWhere =
    user.role === "ADMIN"
      ? {
          id: unitId,
          active: true
        }
      : {
          id: unitId,
          studentId: user.studentId ?? "__missing_student__",
          active: true
        };

  const unit = await prisma.studentUnit.findFirst({
    where: unitWhere,
    select: { id: true, studentId: true }
  });

  if (!unit) {
    return errorResponse(wantsJson, "/app/custos?saveError=1", "invalid_unit", 404);
  }

  try {
    await saveCostForm(unit.id, formData);

    await writeAudit({
      userId,
      studentId: unit.studentId,
      action: "clinicCosts.update",
      entity: "StudentUnit",
      entityId: unit.id,
      metadata: { unitId: unit.id, method: "route-post" }
    });

    revalidatePath("/app/custos");
    revalidatePath("/admin/costs");

    if (wantsJson) {
      return NextResponse.json({ ok: true, unitId: unit.id });
    }

    return redirectTo(costRedirectPath(unit.id, "saved"));
  } catch (error) {
    console.error("Failed to save cost form", error);
    if (wantsJson) {
      return NextResponse.json({ ok: false, error: readableError(error) }, { status: 500 });
    }
    return redirectTo(costRedirectPath(unit.id, "saveError"));
  }
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 240);
  }

  return "save_failed";
}

function errorResponse(wantsJson: boolean, location: string, error: string, status: number) {
  if (wantsJson) {
    return NextResponse.json({ ok: false, error }, { status });
  }

  return redirectTo(location);
}

function redirectTo(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location }
  });
}

function costRedirectPath(unitId: string, result: "saved" | "saveError") {
  const params = new URLSearchParams({ area: unitId, [result]: "1" });
  return `/app/custos?${params.toString()}`;
}

async function saveCostForm(unitId: string, formData: FormData) {
  await saveClinicCostForm(unitId, formData);
}
