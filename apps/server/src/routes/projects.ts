import { CreateProjectSchema, UpdateProjectSchema } from "@seam/schema";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { apiKeys, projects, workspaceMembers } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { serializeRow, serializeRows } from "../lib/serialize";
import { parseBody } from "../lib/validate";
import {
  type AuthEnv,
  getMembership,
  hashKey,
  requireProjectAccess,
  requireSession,
} from "../middleware/auth";

export const projectsRouter = new Hono<AuthEnv>();

// Creating a project requires a user session and a workspace the user
// belongs to (API keys are project-scoped, so they can't create projects).
projectsRouter.post("/", requireSession(), async (c) => {
  const body = parseBody(CreateProjectSchema, await c.req.json());
  const user = c.get("user");
  if (!body.workspaceId) {
    throw new SeamError("INVALID_SCHEMA", 422, "workspaceId is required");
  }
  const membership = await getMembership(user.id, body.workspaceId);
  if (!membership) {
    throw new SeamError("FORBIDDEN", 403, "You are not a member of this workspace");
  }
  const [created] = await db
    .insert(projects)
    .values({
      id: ulid(),
      workspaceId: body.workspaceId,
      name: body.name,
      description: body.description,
    })
    .returning();
  return c.json(serializeRow(created), 201);
});

// List: session users see projects across their workspaces; an admin API key
// sees only its own project.
projectsRouter.get("/", async (c, next) => {
  const rawKey = c.req.header("X-Seam-Key");
  if (!rawKey) {
    await next();
    return;
  }
  const found = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, hashKey(rawKey)),
  });
  if (!found || found.role !== "admin") {
    throw new SeamError("UNAUTHORIZED", 401, "Invalid API key");
  }
  const project = await db.query.projects.findFirst({ where: eq(projects.id, found.projectId) });
  return c.json(project ? [serializeRow(project)] : []);
});

projectsRouter.get("/", requireSession(), async (c) => {
  const user = c.get("user");
  const memberships = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.userId, user.id),
    columns: { workspaceId: true },
  });
  const workspaceIds = memberships.map((m) => m.workspaceId);
  if (workspaceIds.length === 0) return c.json([]);
  const all = await db.query.projects.findMany({
    where: inArray(projects.workspaceId, workspaceIds),
    orderBy: (p, { asc }) => [asc(p.name)],
  });
  return c.json(serializeRows(all));
});

projectsRouter.get("/:projectId", requireProjectAccess("member"), async (c) => {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, param(c, "projectId")),
  });
  if (!project) throw new SeamError("PROJECT_NOT_FOUND", 404, "Project not found");
  return c.json(serializeRow(project));
});

projectsRouter.patch("/:projectId", requireProjectAccess("member"), async (c) => {
  const projectId = param(c, "projectId");
  const body = parseBody(UpdateProjectSchema, await c.req.json());
  const [updated] = await db
    .update(projects)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  if (!updated) throw new SeamError("PROJECT_NOT_FOUND", 404, "Project not found");
  return c.json(serializeRow(updated));
});

// Deleting a project cascades to all its content — workspace admin/owner only.
projectsRouter.delete("/:projectId", requireProjectAccess("admin"), async (c) => {
  const projectId = param(c, "projectId");
  const existing = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!existing) throw new SeamError("PROJECT_NOT_FOUND", 404, "Project not found");
  await db.delete(projects).where(eq(projects.id, projectId));
  return c.body(null, 204);
});
