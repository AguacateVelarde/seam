import { createHash } from "node:crypto";
import type { WorkspaceRole } from "@seam/schema";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { db } from "../db/client";
import { apiKeys, projects, workspaceMembers } from "../db/schema";
import { SeamError } from "../lib/errors";
import { type SessionUser, getUserForToken } from "../services/session";

export type AuthEnv = {
  Variables: {
    projectId: string;
    apiKeyRole: "admin" | "read";
    user: SessionUser;
  };
};

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function bearerToken(c: Context): string | undefined {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return undefined;
}

async function findApiKey(c: Context) {
  const key = c.req.header("X-Seam-Key");
  if (!key) return null;
  const found = await db.query.apiKeys.findFirst({ where: eq(apiKeys.keyHash, hashKey(key)) });
  if (!found) throw new SeamError("UNAUTHORIZED", 401, "Invalid API key");
  return found;
}

async function findSessionUser(c: Context): Promise<SessionUser | null> {
  const token = bearerToken(c);
  if (!token) return null;
  const user = await getUserForToken(token);
  if (!user) throw new SeamError("UNAUTHORIZED", 401, "Invalid or expired session");
  return user;
}

export async function getMembership(userId: string, workspaceId: string) {
  return db.query.workspaceMembers.findFirst({
    where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
  });
}

export function roleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  const order: Record<WorkspaceRole, number> = { member: 0, admin: 1, owner: 2 };
  return order[role] >= order[min];
}

// Delivery API auth: project-scoped API key (read or admin).
export function requireAuth(role: "admin" | "read" = "read") {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const found = await findApiKey(c);
    if (!found) {
      throw new SeamError("UNAUTHORIZED", 401, "Missing X-Seam-Key header");
    }
    if (role === "admin" && found.role !== "admin") {
      throw new SeamError("FORBIDDEN", 403, "Admin key required");
    }
    c.set("projectId", found.projectId);
    c.set("apiKeyRole", found.role);
    await next();
  });
}

// User session auth (Studio): Authorization: Bearer <token>.
export function requireSession() {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = await findSessionUser(c);
    if (!user) {
      throw new SeamError("UNAUTHORIZED", 401, "Missing Authorization bearer token");
    }
    c.set("user", user);
    await next();
  });
}

// Management auth for project-scoped routes. Accepts either:
//  - an admin API key belonging to the project in the path, or
//  - a user session whose user is a member of the project's workspace
//    (minRole controls destructive operations).
// Orphan projects (no workspace yet — pre-setup data) are open to any
// authenticated user; first-run setup claims them into a workspace.
export function requireProjectAccess(minRole: WorkspaceRole = "member") {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const projectId = c.req.param("projectId");
    if (!projectId) throw new SeamError("PROJECT_NOT_FOUND", 404, "Missing project id");

    const apiKey = await findApiKey(c);
    if (apiKey) {
      if (apiKey.role !== "admin") {
        throw new SeamError("FORBIDDEN", 403, "Admin key required");
      }
      if (apiKey.projectId !== projectId) {
        throw new SeamError("FORBIDDEN", 403, "API key does not match project");
      }
      c.set("projectId", apiKey.projectId);
      c.set("apiKeyRole", apiKey.role);
      await next();
      return;
    }

    const user = await findSessionUser(c);
    if (!user) {
      throw new SeamError("UNAUTHORIZED", 401, "Provide an admin API key or a session token");
    }
    c.set("user", user);

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new SeamError("PROJECT_NOT_FOUND", 404, "Project not found");

    if (project.workspaceId) {
      const membership = await getMembership(user.id, project.workspaceId);
      if (!membership) {
        throw new SeamError("FORBIDDEN", 403, "You are not a member of this project's workspace");
      }
      if (!roleAtLeast(membership.role, minRole)) {
        throw new SeamError("FORBIDDEN", 403, `Requires workspace ${minRole} role`);
      }
    }

    await next();
  });
}

// Workspace-scoped auth: session user must be a member with at least minRole.
export function requireWorkspaceRole(minRole: WorkspaceRole = "member") {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const workspaceId = c.req.param("workspaceId");
    if (!workspaceId) throw new SeamError("WORKSPACE_NOT_FOUND", 404, "Missing workspace id");

    const user = await findSessionUser(c);
    if (!user) {
      throw new SeamError("UNAUTHORIZED", 401, "Missing Authorization bearer token");
    }
    c.set("user", user);

    const membership = await getMembership(user.id, workspaceId);
    if (!membership) {
      throw new SeamError("FORBIDDEN", 403, "You are not a member of this workspace");
    }
    if (!roleAtLeast(membership.role, minRole)) {
      throw new SeamError("FORBIDDEN", 403, `Requires workspace ${minRole} role`);
    }
    await next();
  });
}
