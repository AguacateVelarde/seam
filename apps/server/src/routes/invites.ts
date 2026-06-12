import { InviteSignupSchema } from "@seam/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { invites, users, workspaceMembers, workspaces } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { isUniqueViolation } from "../lib/pg-errors";
import { parseBody } from "../lib/validate";
import { type AuthEnv, getMembership, requireSession } from "../middleware/auth";
import { createSession, hashToken } from "../services/session";

// Public invite-token endpoints: inspect, accept (existing user), or sign up.
// Sign-up only exists through invites — there is no open registration.
export const invitesRouter = new Hono<AuthEnv>();

async function findValidInvite(token: string) {
  const invite = await db.query.invites.findFirst({
    where: eq(invites.tokenHash, hashToken(token)),
  });
  if (!invite) throw new SeamError("INVITE_NOT_FOUND", 404, "Invite not found or revoked");
  if (invite.acceptedAt) {
    throw new SeamError("INVITE_NOT_FOUND", 404, "Invite has already been used");
  }
  if (invite.expiresAt < new Date()) {
    throw new SeamError("INVITE_EXPIRED", 410, "Invite has expired");
  }
  return invite;
}

invitesRouter.get("/:token", async (c) => {
  const invite = await findValidInvite(param(c, "token"));
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, invite.workspaceId),
  });
  return c.json({
    workspaceName: workspace?.name ?? "Unknown workspace",
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
  });
});

// Accept with an existing account.
invitesRouter.post("/:token/accept", requireSession(), async (c) => {
  const invite = await findValidInvite(param(c, "token"));
  const user = c.get("user");

  const existing = await getMembership(user.id, invite.workspaceId);
  if (!existing) {
    await db.insert(workspaceMembers).values({
      workspaceId: invite.workspaceId,
      userId: user.id,
      role: invite.role,
    });
  }
  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));
  return c.json({ workspaceId: invite.workspaceId });
});

// Create an account via the invite, join the workspace, and start a session.
invitesRouter.post("/:token/signup", async (c) => {
  const invite = await findValidInvite(param(c, "token"));
  const body = parseBody(InviteSignupSchema, await c.req.json());

  const email = (invite.email ?? body.email)?.toLowerCase();
  if (!email) {
    throw new SeamError("INVALID_SCHEMA", 422, "This invite link has no email — provide one");
  }

  const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existingUser) {
    throw new SeamError(
      "DUPLICATE_NAME",
      409,
      "An account with this email already exists — sign in and accept the invite instead",
    );
  }

  const passwordHash = await Bun.password.hash(body.password);
  try {
    const user = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ id: ulid(), email, name: body.name, passwordHash })
        .returning();
      await tx.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId: row.id,
        role: invite.role,
      });
      await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));
      return row;
    });

    const token = await createSession(user.id);
    return c.json(
      {
        token,
        user: { id: user.id, email: user.email, name: user.name },
        workspaceId: invite.workspaceId,
      },
      201,
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new SeamError("DUPLICATE_NAME", 409, "An account with this email already exists");
    }
    throw err;
  }
});
