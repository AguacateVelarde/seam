import { LoginSchema, SetupSchema } from "@seam/schema";
import { eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { projects, users, workspaceMembers, workspaces } from "../db/schema";
import { SeamError } from "../lib/errors";
import { serializeRow } from "../lib/serialize";
import { parseBody } from "../lib/validate";
import { type AuthEnv, requireSession } from "../middleware/auth";
import { createSession, revokeSession } from "../services/session";

export const authRouter = new Hono<AuthEnv>();

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

// First-run probe: Studio shows the setup wizard when no users exist yet.
authRouter.get("/status", async (c) => {
  const anyUser = await db.query.users.findFirst({ columns: { id: true } });
  return c.json({ needsSetup: !anyUser });
});

// One-time setup: creates the first user (instance admin), their workspace,
// and claims any pre-existing workspace-less projects. Refused once any user
// exists — later users join via invites only.
authRouter.post("/setup", async (c) => {
  const body = parseBody(SetupSchema, await c.req.json());
  const passwordHash = await Bun.password.hash(body.password);

  const result = await db.transaction(async (tx) => {
    const existing = await tx.query.users.findFirst({ columns: { id: true } });
    if (existing) {
      throw new SeamError(
        "SETUP_COMPLETE",
        409,
        "Setup has already been completed — sign in or ask for an invite",
      );
    }
    const [user] = await tx
      .insert(users)
      .values({
        id: ulid(),
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash,
      })
      .returning();
    const [workspace] = await tx
      .insert(workspaces)
      .values({ id: ulid(), name: body.workspaceName ?? "My Workspace" })
      .returning();
    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });
    // Claim orphan projects created before workspaces existed (e.g. seeded data).
    await tx
      .update(projects)
      .set({ workspaceId: workspace.id })
      .where(isNull(projects.workspaceId));
    return { user, workspace };
  });

  const token = await createSession(result.user.id);
  return c.json(
    { token, user: publicUser(result.user), workspace: serializeRow(result.workspace) },
    201,
  );
});

authRouter.post("/login", async (c) => {
  const body = parseBody(LoginSchema, await c.req.json());
  const user = await db.query.users.findFirst({
    where: eq(users.email, body.email.toLowerCase()),
  });
  // Same error for unknown email and wrong password — don't leak which.
  const invalid = new SeamError("UNAUTHORIZED", 401, "Invalid email or password");
  if (!user) throw invalid;
  const ok = await Bun.password.verify(body.password, user.passwordHash);
  if (!ok) throw invalid;

  const token = await createSession(user.id);
  return c.json({ token, user: publicUser(user) });
});

authRouter.post("/logout", requireSession(), async (c) => {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) await revokeSession(header.slice(7));
  return c.body(null, 204);
});

authRouter.get("/me", requireSession(), async (c) => {
  const user = c.get("user");
  const memberships = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, user.id));
  return c.json({ user: publicUser(user), workspaces: memberships });
});
