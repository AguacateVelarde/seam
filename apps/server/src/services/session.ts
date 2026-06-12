import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "../db/client";
import { sessions, users } from "../db/schema";

const SESSION_TTL_DAYS = 30;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = `st_${randomBytes(32).toString("base64url")}`;
  await db.insert(sessions).values({
    id: ulid(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86400_000),
  });
  return token;
}

export type SessionUser = typeof users.$inferSelect;

export async function getUserForToken(token: string): Promise<SessionUser | null> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, hashToken(token)),
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  return user ?? null;
}

export async function revokeSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
