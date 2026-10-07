"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { StudentUnitType, UserRole } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { ensureClinicCostData } from "@/lib/clinic-costs";
import { sendCredentialsEmail } from "@/lib/credential-mail";
import { saveUnitGoal } from "@/lib/goals";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getProfessionals, sanitizeProfessionalName, saveProfessionals } from "@/lib/professionals";
import { getSpecialties, sanitizeSpecialtyName, saveSpecialties } from "@/lib/specialties";
import { sanitizeStaffPermissions, serializeStaffPermissions } from "@/lib/staff-permissions";
import { studentSchema } from "@/lib/validation";

const VALID_UNIT_TYPES = [StudentUnitType.CLINIC, StudentUnitType.MENTORSHIP, StudentUnitType.OTHER] as const;

function parseUnitTypes(formData: FormData) {
  return formData
    .getAll("unitTypes")
    .map(String)
    .filter((value): value is StudentUnitType => (VALID_UNIT_TYPES as readonly string[]).includes(value));
}

function defaultUnitName(type: StudentUnitType, clinicName?: string | null) {
  if (type === StudentUnitType.CLINIC) return clinicName || "Clínica";
  if (type === StudentUnitType.MENTORSHIP) return "Mentoria";
  return "Outros";
}

async function requireStudent(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { users: true, units: true } });
  if (!student) redirect("/admin/students");
  return student;
}

function revalidateStudentPages(studentId: string) {
  revalidatePath("/admin/students");
  revalidatePath(`/admin/student/${studentId}`);
}

export async function createStudentAccount(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = studentSchema.parse(Object.fromEntries(formData));
  const loginEmail = String(formData.get("loginEmail") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const unitTypes = parseUnitTypes(formData);

  if (!loginEmail || password.length < 8) {
    throw new Error("Informe e-mail de login e senha com pelo menos 8 caracteres.");
  }
  if (!unitTypes.length) {
    throw new Error("Selecione pelo menos uma área: clínica, mentoria ou outros.");
  }

  const student = await prisma.student.create({
    data: {
      name: parsed.name,
      clinicName: parsed.clinicName || null,
      email: loginEmail,
      phone: parsed.phone || null,
      active: parsed.active,
      units: {
        create: unitTypes.map((type) => ({
          type,
          name: defaultUnitName(type, parsed.clinicName)
        }))
      }
    },
    include: { units: true }
  });

  await Promise.all(student.units.map((unit) => ensureClinicCostData(unit.id)));

  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: loginEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.STUDENT,
      studentId: student.id,
      mustChangePassword: true
    }
  });

  const mailed = await sendCredentialsEmail({ to: loginEmail, name: parsed.name, password, kind: "novo" });

  await writeAudit({
    userId: admin.id,
    studentId: student.id,
    action: "student.create",
    entity: "Student",
    entityId: student.id,
    metadata: { loginUserId: user.id, unitTypes, credentialsEmailed: mailed }
  });

  revalidatePath("/admin/students");
  redirect(`/admin/students?created=1&mail=${mailed ? "ok" : "off"}`);
}

export async function updateStudentProfile(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);

  const parsed = studentSchema.parse({
    name: formData.get("name"),
    clinicName: formData.get("clinicName") ?? "",
    phone: formData.get("phone") ?? "",
    active: formData.get("active") === "true"
  });
  const paymentChannelEnabled = formData.get("paymentChannelEnabled") === "on";

  await prisma.student.update({
    where: { id: student.id },
    data: {
      name: parsed.name,
      clinicName: parsed.clinicName || null,
      phone: parsed.phone || null,
      active: parsed.active,
      paymentChannelEnabled
    }
  });

  // O login principal do mentorado (papel STUDENT) exibe o nome no painel;
  // mantém sincronizado com o nome do mentorado. Funcionários (STAFF) têm nome próprio.
  await prisma.user.updateMany({
    where: { studentId: student.id, role: UserRole.STUDENT },
    data: { name: parsed.name }
  });

  await writeAudit({
    userId: admin.id,
    studentId: student.id,
    action: "student.update",
    entity: "Student",
    entityId: student.id,
    metadata: { active: parsed.active, paymentChannelEnabled }
  });

  revalidateStudentPages(student.id);
  redirect(`/admin/student/${student.id}?saved=perfil`);
}

export async function updateStudentUnits(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);
  const selected = new Set(parseUnitTypes(formData));

  if (!selected.size) {
    redirect(`/admin/student/${student.id}?error=areas`);
  }

  const createdUnitIds: string[] = [];
  for (const type of VALID_UNIT_TYPES) {
    const existing = student.units.find((unit) => unit.type === type);
    const shouldBeActive = selected.has(type);
    if (existing) {
      const rawName = String(formData.get(`unitName:${existing.id}`) ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      const name = rawName.length >= 2 ? rawName : existing.name;
      if (existing.active !== shouldBeActive || name !== existing.name) {
        await prisma.studentUnit.update({ where: { id: existing.id }, data: { active: shouldBeActive, name } });
      }
    } else if (shouldBeActive) {
      const created = await prisma.studentUnit.create({
        data: { studentId: student.id, type, name: defaultUnitName(type, student.clinicName) }
      });
      createdUnitIds.push(created.id);
    }
  }

  await Promise.all(createdUnitIds.map((unitId) => ensureClinicCostData(unitId)));

  await writeAudit({
    userId: admin.id,
    studentId: student.id,
    action: "student.units.update",
    entity: "Student",
    entityId: student.id,
    metadata: { active: [...selected] }
  });

  revalidateStudentPages(student.id);
  redirect(`/admin/student/${student.id}?saved=areas`);
}

export async function updateStudentLogin(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const userId = String(formData.get("userId") || "");
  const student = await requireStudent(studentId);
  const account = student.users.find((user) => user.id === userId);
  if (!account) redirect(`/admin/student/${student.id}`);

  const email = String(formData.get("email") || "").toLowerCase().trim();
  const newPassword = String(formData.get("newPassword") || "");
  const active = formData.get("active") === "true";

  if (!email || !email.includes("@")) {
    redirect(`/admin/student/${student.id}?error=login`);
  }
  if (newPassword && newPassword.length < 8) {
    redirect(`/admin/student/${student.id}?error=senha`);
  }

  const emailTaken = await prisma.user.findFirst({ where: { email, id: { not: account.id } }, select: { id: true } });
  if (emailTaken) {
    redirect(`/admin/student/${student.id}?error=emailExistente`);
  }

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
    userId: admin.id,
    studentId: student.id,
    action: "student.login.update",
    entity: "User",
    entityId: account.id,
    metadata: { email, active, passwordChanged: Boolean(newPassword), credentialsEmailed: mailed }
  });

  revalidateStudentPages(student.id);
  redirect(`/admin/student/${student.id}?saved=login${mailed === null ? "" : `&mail=${mailed ? "ok" : "off"}`}`);
}

const MAX_STUDENT_LOGINS_PER_STUDENT = 5;

export async function createStudentLogin(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);

  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  if (!email || !email.includes("@") || password.length < 8) {
    redirect(`/admin/student/${student.id}?error=login`);
  }

  if (student.users.filter((user) => user.role === UserRole.STUDENT).length >= MAX_STUDENT_LOGINS_PER_STUDENT) {
    redirect(`/admin/student/${student.id}?error=limiteAcessos`);
  }

  const emailTaken = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (emailTaken) {
    redirect(`/admin/student/${student.id}?error=emailExistente`);
  }

  const account = await prisma.user.create({
    data: {
      name: student.name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.STUDENT,
      studentId: student.id,
      mustChangePassword: true
    }
  });

  const mailed = await sendCredentialsEmail({ to: email, name: student.name, password, kind: "novo" });

  await writeAudit({
    userId: admin.id,
    studentId: student.id,
    action: "student.login.create",
    entity: "User",
    entityId: account.id,
    metadata: { email, credentialsEmailed: mailed }
  });

  revalidateStudentPages(student.id);
  redirect(`/admin/student/${student.id}?saved=login&mail=${mailed ? "ok" : "off"}`);
}

export async function addStudentProfessional(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);

  const name = sanitizeProfessionalName(formData.get("name"));
  if (name) {
    const current = await getProfessionals(student.id);
    await saveProfessionals(student.id, [...current, name]);
    await writeAudit({
      userId: admin.id,
      studentId: student.id,
      action: "professionals.add",
      entity: "Student",
      entityId: student.id,
      metadata: { name, by: "admin" }
    });
  }

  revalidateStudentPages(student.id);
  revalidatePath("/app/financeiro");
  redirect(`/admin/student/${student.id}?saved=equipe`);
}

export async function removeStudentProfessional(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);

  const name = sanitizeProfessionalName(formData.get("name"));
  const current = await getProfessionals(student.id);
  await saveProfessionals(
    student.id,
    current.filter((item) => item.toLocaleLowerCase("pt-BR") !== name.toLocaleLowerCase("pt-BR"))
  );

  await writeAudit({
    userId: admin.id,
    studentId: student.id,
    action: "professionals.remove",
    entity: "Student",
    entityId: student.id,
    metadata: { name, by: "admin" }
  });

  revalidateStudentPages(student.id);
  revalidatePath("/app/financeiro");
  redirect(`/admin/student/${student.id}?saved=equipe`);
}

export async function addStudentSpecialty(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);

  const name = sanitizeSpecialtyName(formData.get("name"));
  if (name) {
    const current = await getSpecialties(student.id);
    await saveSpecialties(student.id, [...current, name]);
    await writeAudit({
      userId: admin.id,
      studentId: student.id,
      action: "specialties.add",
      entity: "Student",
      entityId: student.id,
      metadata: { name, by: "admin" }
    });
  }

  revalidateStudentPages(student.id);
  revalidatePath("/app/financeiro");
  redirect(`/admin/student/${student.id}?saved=equipe`);
}

export async function removeStudentSpecialty(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);

  const name = sanitizeSpecialtyName(formData.get("name"));
  const current = await getSpecialties(student.id);
  await saveSpecialties(
    student.id,
    current.filter((item) => item.toLocaleLowerCase("pt-BR") !== name.toLocaleLowerCase("pt-BR"))
  );

  await writeAudit({
    userId: admin.id,
    studentId: student.id,
    action: "specialties.remove",
    entity: "Student",
    entityId: student.id,
    metadata: { name, by: "admin" }
  });

  revalidateStudentPages(student.id);
  revalidatePath("/app/financeiro");
  redirect(`/admin/student/${student.id}?saved=equipe`);
}

const MAX_STAFF_PER_STUDENT = 15;

export async function createStaffLogin(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);

  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const permissions = sanitizeStaffPermissions(formData.getAll("permissions"));
  if (!name || !email || !email.includes("@") || password.length < 8) {
    redirect(`/admin/student/${student.id}?error=login`);
  }
  if (!permissions.length) {
    redirect(`/admin/student/${student.id}?error=permissoes`);
  }

  if (student.users.filter((user) => user.role === UserRole.STAFF).length >= MAX_STAFF_PER_STUDENT) {
    redirect(`/admin/student/${student.id}?error=limiteFuncionarios`);
  }

  const emailTaken = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (emailTaken) {
    redirect(`/admin/student/${student.id}?error=emailExistente`);
  }

  const account = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.STAFF,
      studentId: student.id,
      mustChangePassword: true,
      permissions: serializeStaffPermissions(permissions)
    }
  });

  const mailed = await sendCredentialsEmail({ to: email, name, password, kind: "novo" });

  await writeAudit({
    userId: admin.id,
    studentId: student.id,
    action: "staff.login.create",
    entity: "User",
    entityId: account.id,
    metadata: { email, credentialsEmailed: mailed, permissions }
  });

  revalidateStudentPages(student.id);
  redirect(`/admin/student/${student.id}?saved=funcionario&mail=${mailed ? "ok" : "off"}`);
}

export async function updateStaffLogin(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const userId = String(formData.get("userId") || "");
  const student = await requireStudent(studentId);
  const account = student.users.find((user) => user.id === userId && user.role === UserRole.STAFF);
  if (!account) redirect(`/admin/student/${student.id}`);

  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const newPassword = String(formData.get("newPassword") || "");
  const active = formData.get("active") === "true";
  const permissions = sanitizeStaffPermissions(formData.getAll("permissions"));

  if (!name) redirect(`/admin/student/${student.id}?error=login`);
  if (!email || !email.includes("@")) redirect(`/admin/student/${student.id}?error=login`);
  if (newPassword && newPassword.length < 8) redirect(`/admin/student/${student.id}?error=senha`);
  if (!permissions.length) redirect(`/admin/student/${student.id}?error=permissoes`);

  const emailTaken = await prisma.user.findFirst({ where: { email, id: { not: account.id } }, select: { id: true } });
  if (emailTaken) redirect(`/admin/student/${student.id}?error=emailExistente`);

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
    userId: admin.id,
    studentId: student.id,
    action: "staff.login.update",
    entity: "User",
    entityId: account.id,
    metadata: { email, active, passwordChanged: Boolean(newPassword), credentialsEmailed: mailed, permissions }
  });

  revalidateStudentPages(student.id);
  redirect(`/admin/student/${student.id}?saved=funcionario${mailed === null ? "" : `&mail=${mailed ? "ok" : "off"}`}`);
}

export async function deleteStaffLogin(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const userId = String(formData.get("userId") || "");
  const student = await requireStudent(studentId);
  const account = student.users.find((user) => user.id === userId && user.role === UserRole.STAFF);
  if (!account) redirect(`/admin/student/${student.id}`);

  await prisma.$transaction([
    prisma.auditLog.updateMany({ where: { userId: account.id }, data: { userId: null } }),
    prisma.user.delete({ where: { id: account.id } })
  ]);

  await writeAudit({
    userId: admin.id,
    studentId: student.id,
    action: "staff.login.delete",
    entity: "User",
    entityId: account.id,
    metadata: { email: account.email }
  });

  revalidateStudentPages(student.id);
  redirect(`/admin/student/${student.id}?saved=funcionario`);
}

export async function updateStudentGoals(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);

  const saved: Record<string, number> = {};
  for (const unit of student.units.filter((item) => item.active)) {
    const raw = String(formData.get(`goal:${unit.id}`) ?? "").replace(",", ".");
    const target = Number(raw);
    saved[unit.id] = await saveUnitGoal(unit.id, Number.isFinite(target) ? target : 0);
  }

  await writeAudit({
    userId: admin.id,
    studentId: student.id,
    action: "student.goals.update",
    entity: "Student",
    entityId: student.id,
    metadata: { goals: saved }
  });

  revalidateStudentPages(student.id);
  revalidatePath("/admin");
  revalidatePath("/app");
  redirect(`/admin/student/${student.id}?saved=metas`);
}

export async function deleteStudentAccount(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const student = await requireStudent(studentId);

  const unitIds = student.units.map((unit) => unit.id);
  const userIds = student.users.map((user) => user.id);
  const settingKeys = [
    ...unitIds.map((unitId) => `clinic-costs:${unitId}`),
    `professionals:${student.id}`,
    `specialties:${student.id}`
  ];

  await prisma.$transaction([
    prisma.financeEntry.deleteMany({ where: { studentId: student.id } }),
    prisma.messageEntry.deleteMany({ where: { studentId: student.id } }),
    prisma.clinicRoomHour.deleteMany({ where: { unitId: { in: unitIds } } }),
    prisma.clinicExpenseItem.deleteMany({ where: { unitId: { in: unitIds } } }),
    prisma.clinicCostSetting.deleteMany({ where: { unitId: { in: unitIds } } }),
    prisma.appSetting.deleteMany({ where: { key: { in: settingKeys } } }),
    prisma.auditLog.updateMany({ where: { studentId: student.id }, data: { studentId: null } }),
    prisma.auditLog.updateMany({ where: { userId: { in: userIds } }, data: { userId: null } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.studentUnit.deleteMany({ where: { studentId: student.id } }),
    prisma.student.delete({ where: { id: student.id } })
  ]);

  await writeAudit({
    userId: admin.id,
    action: "student.delete",
    entity: "Student",
    entityId: student.id,
    metadata: {
      name: student.name,
      units: unitIds.length,
      logins: userIds.length
    }
  });

  revalidatePath("/admin/students");
  revalidatePath("/admin");
  redirect("/admin/students?deleted=1");
}
