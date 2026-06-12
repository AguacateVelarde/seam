import { CreatePublicationSchema } from "@seam/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { experiments, publications, screens, snapshots } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { serializeRow, serializeRows } from "../lib/serialize";
import { parseBody } from "../lib/validate";
import { type AuthEnv, requireProjectAccess } from "../middleware/auth";
import { findScreen } from "./screens";

// Publications are immutable. DELETE performs rollback, not deletion.
export const publicationsRouter = new Hono<AuthEnv>();

publicationsRouter.use("*", requireProjectAccess("member"));

publicationsRouter.post("/", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  await findScreen(projectId, screenId);

  const body = parseBody(CreatePublicationSchema, await c.req.json());

  // 1. Validate snapshot belongs to this screen.
  const snapshot = await db.query.snapshots.findFirst({
    where: and(eq(snapshots.id, body.snapshotId), eq(snapshots.screenId, screenId)),
  });
  if (!snapshot) {
    throw new SeamError("SNAPSHOT_NOT_FOUND", 404, "Snapshot not found for this screen");
  }

  // 2. If experimentId provided, it must exist, belong to the project, and be active.
  if (body.experimentId) {
    const experiment = await db.query.experiments.findFirst({
      where: and(eq(experiments.id, body.experimentId), eq(experiments.projectId, projectId)),
    });
    if (!experiment) {
      throw new SeamError("EXPERIMENT_NOT_FOUND", 404, "Experiment not found in this project");
    }
    if (experiment.status !== "active") {
      throw new SeamError(
        "EXPERIMENT_CONFLICT",
        409,
        `Experiment must be active to publish (current status: ${experiment.status})`,
      );
    }
  }

  // 3+4. Create publication and point the screen at it, atomically.
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(publications)
      .values({
        id: ulid(),
        screenId,
        snapshotId: body.snapshotId,
        experimentId: body.experimentId,
        isDefault: true,
        publishedBy: body.publishedBy,
      })
      .returning();
    await tx
      .update(screens)
      .set({ activePublicationId: row.id, updatedAt: new Date() })
      .where(eq(screens.id, screenId));
    return row;
  });

  return c.json(serializeRow(created), 201);
});

publicationsRouter.get("/", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  await findScreen(projectId, screenId);
  const all = await db.query.publications.findMany({
    where: eq(publications.screenId, screenId),
    orderBy: [desc(publications.publishedAt)],
  });
  return c.json(serializeRows(all));
});

// Rollback: re-point the screen at the previous publication. The "deleted"
// publication stays in the table — archived, not removed.
publicationsRouter.delete("/:publicationId", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  const publicationId = param(c, "publicationId");
  await findScreen(projectId, screenId);

  const publication = await db.query.publications.findFirst({
    where: and(eq(publications.id, publicationId), eq(publications.screenId, screenId)),
  });
  if (!publication) {
    throw new SeamError("PUBLICATION_NOT_FOUND", 404, "Publication not found");
  }

  await db.transaction(async (tx) => {
    const previous = await tx.query.publications.findFirst({
      where: and(
        eq(publications.screenId, screenId),
        lt(publications.publishedAt, publication.publishedAt),
      ),
      orderBy: [desc(publications.publishedAt)],
    });
    // No previous publication → screen returns to draft status.
    await tx
      .update(screens)
      .set({ activePublicationId: previous?.id ?? null, updatedAt: new Date() })
      .where(eq(screens.id, screenId));
  });

  return c.body(null, 204);
});
