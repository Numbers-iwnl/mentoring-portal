import { AppShell } from "@/components/layout/app-shell";
import { getStaffPermissions, requireStudentAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, studentId } = await requireStudentAccess();
  const isStaff = user.role === "STAFF";
  const mode = isStaff ? "staff" : "student";

  // O menu do funcionário mostra só as partes liberadas no cadastro (lidas ao
  // vivo do banco, então mudanças do admin valem sem precisar sair e entrar).
  const staffSections = isStaff ? await getStaffPermissions(user.id) : undefined;

  // O nome do mentorado (papel STUDENT) vem do cadastro atual, refletindo
  // renomeações na hora. Funcionários (STAFF) mantêm o próprio nome de login.
  const student = !isStaff && studentId ? await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } }) : null;
  const userName = isStaff ? user.name ?? "Funcionário" : student?.name ?? user.name ?? "Mentorado";

  return (
    <AppShell mode={mode} userName={userName} subtitle={user.studentName ?? undefined} staffSections={staffSections}>
      {children}
    </AppShell>
  );
}
