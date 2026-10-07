import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";

const PREFIX = "pwreset:";
export const RESET_TOKEN_TTL_MINUTES = 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenKey(token: string) {
  return `${PREFIX}${hashToken(token)}`;
}

export async function createResetToken(userId: string) {
  // Opportunistic cleanup of stale tokens (anything older than 2h).
  await prisma.appSetting.deleteMany({
    where: { key: { startsWith: PREFIX }, updatedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } }
  });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
  await prisma.appSetting.create({
    data: { key: tokenKey(token), value: { version: 1, userId, expiresAt } }
  });
  return token;
}

/** Validates without consuming (used to render the reset page). */
export async function peekResetToken(token: string): Promise<string | null> {
  if (!token || token.length > 128) return null;
  const stored = await prisma.appSetting.findUnique({ where: { key: tokenKey(token) }, select: { value: true } });
  if (!stored || typeof stored.value !== "object" || Array.isArray(stored.value) || stored.value === null) return null;
  const raw = stored.value as Record<string, unknown>;
  const userId = typeof raw.userId === "string" ? raw.userId : null;
  const expiresAt = typeof raw.expiresAt === "string" ? new Date(raw.expiresAt) : null;
  if (!userId || !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) return null;
  return userId;
}

/** Single-use: validates and deletes the token. */
export async function consumeResetToken(token: string): Promise<string | null> {
  const userId = await peekResetToken(token);
  if (!userId) return null;
  await prisma.appSetting.deleteMany({ where: { key: tokenKey(token) } });
  return userId;
}
