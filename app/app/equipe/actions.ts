"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { sendCredentialsEmail } from "@/lib/credential-mail";
import { requireStudentAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getProfessionals, sanitizeProfessionalName, saveProfessionals } from "@/lib/professionals";
import { getSpecialties, sanitizeSpecialtyName, saveSpecialties } from "@/lib/specialties";
import { sanitizeStaffPermissions, serializeStaffPermissions } from "@/lib/staff-permissions";

const MAX_STAFF_PER_STUDENT = 15;
const MAX_STUDENT_LOGINS_PER_STUDENT = 5;

async function requireOwnStudent() {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId || user.role === "STAFF") redirect("/app");
  return { user, studentId };
}

function revalidateTeamPages() {
  revalidatePath("/app/equipe");
  revalidatePath("/app/financeiro");
}

export async function addProfessional(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");

  const name = sanitizeProfessionalName(formData.get("name"));
  if (!name) redirect("/app/equipe");

  const current = await getProfessionals(studentId);
  const next = await saveProfessionals(studentId, [...current, name]);

  await writeAudit({
    userId: user.id,
    studentId,
    action: "professionals.add",
    entity: "Student",
    entityId: studentId,
    metadata: { name, total: next.length }
  });

  revalidateTeamPages();
  redirect("/app/equipe");
}

export async function renameOwnAreas(formData: FormData) {
  const { user, studentId } = await requireOwnStudent();

  const units = await prisma.studentUnit.findMany({ where: { studentId, active: true } });
  const renamed: Record<string, string> = {};
  for (const unit of units) {
    const name = String(formData.get(`unitName:${unit.id}`) ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    if (name.length >= 2 && name !== unit.name) {
      await prisma.studentUnit.update({ where: { id: unit.id }, data: { name } });
      renamed[unit.id] = name;
    }
  }

  if (Object.keys(renamed).length) {
    await writeAudit({
      userId: user.id,
      studentId,
      action: "student.units.rename",
      entity: "Student",
      entityId: studentId,
      metadata: { renamed, by: "student" }
    });
  }

  revalidatePath("/app");
  revalidatePath("/app/equipe");
  revalidatePath("/app/financeiro");
  revalidatePath("/app/mensagens");
  redirect("/app/equipe?saved=areas");
}

export async function createOwnStaffLogin(formData: FormData) {
  const { user, studentId } = await requireOwnStudent();

  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const permissions = sanitizeStaffPermissions(formData.getAll("permissions"));
  if (!name || !email || !email.includes("@") || password.length < 8) {
    redirect("/app/equipe?error=login");
  }
  if (!permissions.length) redirect("/app/equipe?error=permissoes");

  const staffCount = await prisma.user.count({ where: { studentId, role: UserRole.STAFF } });
  if (staffCount >= MAX_STAFF_PER_STUDENT) redirect("/app/equipe?error=limiteFuncionarios");

  const emailTaken = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (emailTaken) redirect("/app/equipe?error=emailExistente");

  const account = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.STAFF,
      studentId,
      mustChangePassword: true,
      permissions: serializeStaffPermissions(permissions)
    }
  });

  const mailed = await sendCredentialsEmail({ to: email, name, password, kind: "novo" });

  await writeAudit({
    userId: user.id,
    studentId,
    action: "staff.login.create",
    entity: "User",
    entityId: account.id,
    metadata: { email, credentialsEmailed: mailed, by: "student", permissions }
  });

  revalidateTeamPages();
  redirect(`/app/equipe?saved=funcionario&mail=${mailed ? "ok" : "off"}`);
}

export async function updateOwnStaffLogin(formData: FormData) {
  const { user, studentId } = await requireOwnStudent();

  const userId = String(formData.get("userId") || "");
  const account = await prisma.user.findFirst({ where: { id: userId, studentId, role: UserRole.STAFF } });
  if (!account) redirect("/app/equipe");

  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const newPassword = String(formData.get("newPassword") || "");
  const active = formData.get("active") === "true";
  const permissions = sanitizeStaffPermissions(formData.getAll("permissions"));

  if (!name) redirect("/app/equipe?error=login");
  if (!email || !email.includes("@")) redirect("/app/equipe?error=login");
  if (newPassword && newPassword.length < 8) redirect("/app/equipe?error=senha");
  if (!permissions.length) redirect("/app/equipe?error=permissoes");

  const emailTaken = await prisma.user.findFirst({ where: { email, id: { not: account.id } }, select: { id: true } });
  if (emailTaken) redirect("/app/equipe?error=emailExistente");

  await prisma.user.update({
    where: { id: account.id },
    data: {
      name,
      email,
      active,
      permissions: serializeStaffPermissions(permissions),
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: true } : {})
    }
  });

  const mailed = newPassword ? await sendCredentialsEmail({ to: email, name, password: newPassword, kind: "redefinido" }) : null;

  await writeAudit({
    userId: user.id,
    studentId,
    action: "staff.login.update",
    entity: "User",
    entityId: account.id,
    metadata: { email, active, passwordChanged: Boolean(newPassword), credentialsEmailed: mailed, by: "student", permissions }
  });

  revalidateTeamPages();
  redirect(`/app/equipe?saved=funcionario${mailed === null ? "" : `&mail=${mailed ? "ok" : "off"}`}`);
}

export async function deleteOwnStaffLogin(formData: FormData) {
  const { user, studentId } = await requireOwnStudent();

  const userId = String(formData.get("userId") || "");
  const account = await prisma.user.findFirst({ where: { id: userId, studentId, role: UserRole.STAFF } });
  if (!account) redirect("/app/equipe");

  await prisma.$transaction([
    prisma.auditLog.updateMany({ where: { userId: account.id }, data: { userId: null } }),
    prisma.user.delete({ where: { id: account.id } })
  ]);

  await writeAudit({
    userId: user.id,
    studentId,
    action: "staff.login.delete",
    entity: "User",
    entityId: account.id,
    metadata: { email: account.email, by: "student" }
  });

  revalidateTeamPages();
  redirect("/app/equipe?saved=funcionario");
}

export async function removeProfessional(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");

  const name = sanitizeProfessionalName(formData.get("name"));
  const current = await getProfessionals(studentId);
  const next = await saveProfessionals(
    studentId,
    current.filter((item) => item.toLocaleLowerCase("pt-BR") !== name.toLocaleLowerCase("pt-BR"))
  );

  await writeAudit({
    userId: user.id,
    studentId,
    action: "professionals.remove",
    entity: "Student",
    entityId: studentId,
    metadata: { name, total: next.length }
  });

  revalidateTeamPages();
  redirect("/app/equipe");
}

export async function addSpecialty(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");

  const name = sanitizeSpecialtyName(formData.get("name"));
  if (!name) redirect("/app/equipe");

  const current = await getSpecialties(studentId);
  const next = await saveSpecialties(studentId, [...current, name]);

  await writeAudit({
    userId: user.id,
    studentId,
    action: "specialties.add",
    entity: "Student",
    entityId: studentId,
    metadata: { name, total: next.length }
  });

  revalidateTeamPages();
  redirect("/app/equipe");
}

export async function removeSpecialty(formData: FormData) {
  const { user, studentId } = await requireStudentAccess();
  if (!studentId) redirect("/login");

  const name = sanitizeSpecialtyName(formData.get("name"));
  const current = await getSpecialties(studentId);
  const next = await saveSpecialties(
    studentId,
    current.filter((item) => item.toLocaleLowerCase("pt-BR") !== name.toLocaleLowerCase("pt-BR"))
  );

  await writeAudit({
    userId: user.id,
    studentId,
    action: "specialties.remove",
    entity: "Student",
    entityId: studentId,
    metadata: { name, total: next.length }
  });

  revalidateTeamPages();
  redirect("/app/equipe");
}

/**
 * Acesso administrativo completo (mesmo nível do login principal — NÃO é
 * funcionário limitado). Autosserviço: o próprio mentorado cria, sem passar
 * pelo admin da Aurora. Mantém o mesmo nome da conta (sincronizado
 * com updateStudentProfile) em vez de um nome próprio por pessoa.
 */
export async function createOwnAdminLogin(formData: FormData) {
  const { user, studentId } = await requireOwnStudent();

  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  if (!email || !email.includes("@") || password.length < 8) {
    redirect("/app/equipe?error=loginAdmin");
  }

  const loginCount = await prisma.user.count({ where: { studentId, role: UserRole.STUDENT } });
  if (loginCount >= MAX_STUDENT_LOGINS_PER_STUDENT) redirect("/app/equipe?error=limiteAdmins");

  const emailTaken = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (emailTaken) redirect("/app/equipe?error=emailExistenteAdmin");

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  const name = student?.name ?? "Administrador";

  const account = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.STUDENT,
      studentId,
      mustChangePassword: true
    }
  });

  const mailed = await sendCredentialsEmail({ to: email, name, password, kind: "novo" });

  await writeAudit({
    userId: user.id,
    studentId,
    action: "student.login.create",
    entity: "User",
    entityId: account.id,
    metadata: { email, credentialsEmailed: mailed, by: "student" }
  });

  revalidateTeamPages();
  redirect(`/app/equipe?saved=admin&mail=${mailed ? "ok" : "off"}`);
}

export async function updateOwnAdminLogin(formData: FormData) {
  const { user, studentId } = await requireOwnStudent();

  const userId = String(formData.get("userId") || "");
  const account = await prisma.user.findFirst({ where: { id: userId, studentId, role: UserRole.STUDENT } });
  if (!account) redirect("/app/equipe");

  const email = String(formData.get("email") || "").toLowerCase().trim();
  const newPassword = String(formData.get("newPassword") || "");
  const active = formData.get("active") === "true";

  if (!email || !email.includes("@")) redirect("/app/equipe?error=loginAdmin");
  if (newPassword && newPassword.length < 8) redirect("/app/equipe?error=senha");

  if (!active) {
    // Não deixa a própria sessão se bloquear, nem zerar todos os acessos administrativos da conta.
    if (account.id === user.id) redirect("/app/equipe?error=bloqueioProprio");
    const otherActive = await prisma.user.count({
      where: { studentId, role: UserRole.STUDENT, active: true, id: { not: account.id } }
    });
    if (otherActive === 0) redirect("/app/equipe?error=ultimoAdmin");
  }

  const emailTaken = await prisma.user.findFirst({ where: { email, id: { not: account.id } }, select: { id: true } });
  if (emailTaken) redirect("/app/equipe?error=emailExistenteAdmin");

  await prisma.user.update({
    where: { id: account.id },
    data: {
      email,
      active,
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: true } : {})
    }
  });

  const mailed = newPassword ? await sendCredentialsEmail({ to: email, name: account.name, password: newPassword, kind: "redefinido" }) : null;

  await writeAudit({
    userId: user.id,
    studentId,
    action: "student.login.update",
    entity: "User",
    entityId: account.id,
    metadata: { email, active, passwordChanged: Boolean(newPassword), credentialsEmailed: mailed, by: "student" }
  });

  revalidateTeamPages();
  redirect(`/app/equipe?saved=admin${mailed === null ? "" : `&mail=${mailed ? "ok" : "off"}`}`);
}
