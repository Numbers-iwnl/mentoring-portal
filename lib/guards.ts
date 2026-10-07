import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { parseStaffPermissions, staffLandingPath, type StaffSection } from "./staff-permissions";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/app");
  return user;
}

export async function requireStudentAccess(studentId?: string) {
  const user = await requireUser();
  if (user.role === "ADMIN") return { user, studentId };
  if (!user.studentId) redirect("/login");
  if (studentId && studentId !== user.studentId) redirect("/app");
  return { user, studentId: user.studentId };
}

/** Reads a funcionário's live permission set from the DB (fresh, not from the session token). */
export async function getStaffPermissions(userId: string): Promise<StaffSection[]> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { permissions: true } });
  return parseStaffPermissions(row?.permissions ?? null);
}

/**
 * Page-level guard. Mentorados/admin pass through untouched. A funcionário
 * without the given section is redirected to their first allowed page.
 * Permissions are read live so admin changes take effect without re-login.
 */
export async function requireStaffSection(section: StaffSection) {
  const result = await requireStudentAccess();
  if (result.user.role === "STAFF") {
    const permissions = await getStaffPermissions(result.user.id);
    if (!permissions.includes(section)) redirect(staffLandingPath(permissions));
  }
  return result;
}

/** Blocks funcionários entirely (e.g. the Equipe management page). */
export async function blockStaff() {
  const result = await requireStudentAccess();
  if (result.user.role === "STAFF") {
    const permissions = await getStaffPermissions(result.user.id);
    redirect(staffLandingPath(permissions));
  }
  return result;
}
