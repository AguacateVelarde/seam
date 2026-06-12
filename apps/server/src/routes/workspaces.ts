import { randomBytes } from "node:crypto";
import {
  CreateInviteSchema,
  CreateWorkspaceSchema,
  UpdateMemberSchema,
  UpdateWorkspaceSchema,
} from "@seam/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { invites, users, workspaceMembers, workspaces } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { serializeRow, serializeRows } from "../lib/serialize";
import { parseBody } from "../lib/validate";
import { type AuthEnv, requireSession, requireWorkspaceRole } from "../middleware/auth";
import { hashToken } from "../services/session";

const INVITE_TTL_DAYS = 7;

export const workspacesRouter = new Hono<AuthEnv>();

workspacesRouter.post("/", requireSession(), async (c) => {
  const body = parseBody(CreateWorkspaceSchema, await c.req.json());
  const user = c.get("user");
  const workspace = await db.transaction(async (tx) => {
    const [row] = await tx.insert(workspaces).values({ id: ulid(), name: body.name }).returning();
    await tx.insert(workspaceMembers).values({
      workspaceId: row.id,
      userId: user.id,
      role: "owner",
    });
    return row;
  });
  return c.json(serializeRow(workspace), 201);
});

workspacesRouter.get("/", requireSession(), async (c) => {
  const user = c.get("user");
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      role: workspaceMembers.role,
      createdAt: workspaces.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, user.id));
  return c.json(serializeRows(rows));
});

workspacesRouter.patch("/:workspaceId", requireWorkspaceRole("admin"), async (c) => {
  const body = parseBody(UpdateWorkspaceSchema, await c.req.json());
  const [updated] = await db
    .update(workspaces)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(workspaces.id, param(c, "workspaceId")))
    .returning();
  if (!updated) throw new SeamError("WORKSPACE_NOT_FOUND", 404, "Workspace not found");
  return c.json(serializeRow(updated));
});

workspacesRouter.delete("/:workspaceId", requireWorkspaceRole("owner"), async (c) => {
  await db.delete(workspaces).where(eq(workspaces.id, param(c, "workspaceId")));
  return c.body(null, 204);
});

// --- Members ---

workspacesRouter.get("/:workspaceId/members", requireWorkspaceRole("member"), async (c) => {
  const rows = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      createdAt: workspaceMembers.createdAt,
      email: users.email,
      name: users.name,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, param(c, "workspaceId")));
  return c.json(serializeRows(rows));
});

workspacesRouter.patch(
  "/:workspaceId/members/:userId",
  requireWorkspaceRole("admin"),
  async (c) => {
    const workspaceId = param(c, "workspaceId");
    const targetUserId = param(c, "userId");
    const body = parseBody(UpdateMemberSchema, await c.req.json());

    const target = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    });
    if (!target) throw new SeamError("MEMBER_NOT_FOUND", 404, "Member not found");
    if (target.role === "owner") {
      throw new SeamError("FORBIDDEN", 403, "The workspace owner's role cannot be changed");
    }
    if (body.role === "owner") {
      throw new SeamError("FORBIDDEN", 403, "Ownership transfer is not supported yet");
    }

    const [updated] = await db
      .update(workspaceMembers)
      .set({ role: body.role })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
        ),
      )
      .returning();
    return c.json(serializeRow(updated));
  },
);

workspacesRouter.delete(
  "/:workspaceId/members/:userId",
  requireWorkspaceRole("admin"),
  async (c) => {
    const workspaceId = param(c, "workspaceId");
    const targetUserId = param(c, "userId");
    const target = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    });
    if (!target) throw new SeamError("MEMBER_NOT_FOUND", 404, "Member not found");
    if (target.role === "owner") {
      throw new SeamError("FORBIDDEN", 403, "The workspace owner cannot be removed");
    }
    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
        ),
      );
    return c.body(null, 204);
  },
);

// --- Invites ---

workspacesRouter.post("/:workspaceId/invites", requireWorkspaceRole("admin"), async (c) => {
  const workspaceId = param(c, "workspaceId");
  const body = parseBody(CreateInviteSchema, await c.req.json());
  const user = c.get("user");

  // Raw token is returned exactly once; only its hash is stored. The caller
  // (Studio) builds the shareable URL from its own origin.
  const token = `inv_${randomBytes(24).toString("base64url")}`;
  const [invite] = await db
    .insert(invites)
    .values({
      id: ulid(),
      workspaceId,
      email: body.email?.toLowerCase(),
      role: body.role,
      tokenHash: hashToken(token),
      invitedBy: user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000),
    })
    .returning();

  const { tokenHash: _tokenHash, ...safe } = invite;
  return c.json({ ...serializeRow(safe), token }, 201);
});

workspacesRouter.get("/:workspaceId/invites", requireWorkspaceRole("admin"), async (c) => {
  const rows = await db.query.invites.findMany({
    where: and(eq(invites.workspaceId, param(c, "workspaceId")), isNull(invites.acceptedAt)),
    orderBy: [desc(invites.createdAt)],
  });
  // Never expose token hashes.
  return c.json(serializeRows(rows.map(({ tokenHash: _tokenHash, ...rest }) => rest)));
});

workspacesRouter.delete(
  "/:workspaceId/invites/:inviteId",
  requireWorkspaceRole("admin"),
  async (c) => {
    await db
      .delete(invites)
      .where(
        and(eq(invites.id, param(c, "inviteId")), eq(invites.workspaceId, param(c, "workspaceId"))),
      );
    return c.body(null, 204);
  },
);
