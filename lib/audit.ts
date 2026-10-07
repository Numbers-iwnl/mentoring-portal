import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type AuditInput = {
  userId?: string;
  studentId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      studentId: input.studentId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata ?? undefined
    }
  });
}
