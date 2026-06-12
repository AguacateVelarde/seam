import { randomBytes } from "node:crypto";
import { CreateApiKeySchema } from "@seam/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { apiKeys } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { serializeRows } from "../lib/serialize";
import { parseBody } from "../lib/validate";
import { type AuthEnv, hashKey, requireProjectAccess } from "../middleware/auth";

// Project API key management. Keys are how clients consume the Delivery API
// (read role) and how CI/automation talks to the Management API (admin role).
// Mutations require workspace admin/owner (or the project's admin key).
export const keysRouter = new Hono<AuthEnv>();

keysRouter.post("/", requireProjectAccess("admin"), async (c) => {
  const projectId = param(c, "projectId");
  const body = parseBody(CreateApiKeySchema, await c.req.json());

  const prefix = body.role === "admin" ? "sk_admin" : "sk_read";
  const rawKey = `${prefix}_${randomBytes(24).toString("base64url")}`;

  const [created] = await db
    .insert(apiKeys)
    .values({
      id: ulid(),
      projectId,
      role: body.role,
      keyHash: hashKey(rawKey),
      label: body.label,
    })
    .returning();

  // The raw key is shown exactly once — only its hash is stored.
  return c.json(
    {
      id: created.id,
      projectId: created.projectId,
      role: created.role,
      label: created.label,
      createdAt: created.createdAt.toISOString(),
      key: rawKey,
    },
    201,
  );
});

keysRouter.get("/", requireProjectAccess("member"), async (c) => {
  const rows = await db.query.apiKeys.findMany({
    where: eq(apiKeys.projectId, param(c, "projectId")),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return c.json(serializeRows(rows.map(({ keyHash: _keyHash, ...rest }) => rest)));
});

keysRouter.delete("/:keyId", requireProjectAccess("admin"), async (c) => {
  const projectId = param(c, "projectId");
  const keyId = param(c, "keyId");
  const existing = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId)),
  });
  if (!existing) throw new SeamError("KEY_NOT_FOUND", 404, "API key not found");
  await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
  return c.body(null, 204);
});
