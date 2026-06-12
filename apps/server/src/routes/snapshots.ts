import { CreateSnapshotSchema } from "@seam/schema";
import { and, desc, eq, max } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { snapshots } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { serializeRow, serializeRows } from "../lib/serialize";
import { parseBody } from "../lib/validate";
import { type AuthEnv, requireProjectAccess } from "../middleware/auth";
import { findScreen } from "./screens";

// Snapshots are immutable — only POST and GET, no PATCH, no DELETE.
export const snapshotsRouter = new Hono<AuthEnv>();

snapshotsRouter.use("*", requireProjectAccess("member"));

snapshotsRouter.post("/", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  await findScreen(projectId, screenId);

  const body = parseBody(CreateSnapshotSchema, await c.req.json());

  // Auto-increment version per screen, inside a transaction to avoid races.
  const created = await db.transaction(async (tx) => {
    const [{ maxVersion }] = await tx
      .select({ maxVersion: max(snapshots.version) })
      .from(snapshots)
      .where(eq(snapshots.screenId, screenId));
    const [row] = await tx
      .insert(snapshots)
      .values({
        id: ulid(),
        screenId,
        version: (maxVersion ?? 0) + 1,
        tree: body.tree,
        createdBy: body.createdBy,
      })
      .returning();
    return row;
  });

  return c.json(serializeRow(created), 201);
});

snapshotsRouter.get("/", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  await findScreen(projectId, screenId);
  const all = await db.query.snapshots.findMany({
    where: eq(snapshots.screenId, screenId),
    orderBy: [desc(snapshots.version)],
  });
  return c.json(serializeRows(all));
});

snapshotsRouter.get("/:snapshotId", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  await findScreen(projectId, screenId);
  const snapshot = await db.query.snapshots.findFirst({
    where: and(eq(snapshots.id, param(c, "snapshotId")), eq(snapshots.screenId, screenId)),
  });
  if (!snapshot) throw new SeamError("SNAPSHOT_NOT_FOUND", 404, "Snapshot not found");
  return c.json(serializeRow(snapshot));
});
