import {
  ChannelSchema,
  CreatePublicationSchema,
  type Node,
  PromotePublicationSchema,
  type Variant,
} from "@seam/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { experiments, publications, snapshots } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { serializeRow, serializeRows } from "../lib/serialize";
import { collectNodeIds } from "../lib/tree";
import { parseBody } from "../lib/validate";
import { type AuthEnv, requireProjectAccess } from "../middleware/auth";
import { getChannelState, setChannelState } from "../services/channels";
import { findScreen } from "./screens";

// Publications are immutable, channel-tagged records. DELETE performs a
// channel-scoped rollback, not a deletion. Promote copies a channel's active
// publication to another channel as a new record.
export const publicationsRouter = new Hono<AuthEnv>();

publicationsRouter.use("*", requireProjectAccess("member"));

// Validate that an experiment can ship with the given snapshot tree.
async function assertExperimentPublishable(
  projectId: string,
  experimentId: string,
  tree: Node,
): Promise<void> {
  const experiment = await db.query.experiments.findFirst({
    where: and(eq(experiments.id, experimentId), eq(experiments.projectId, projectId)),
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

  // Patch-based variants must reference nodes that exist in the base
  // snapshot being published — and may not hide its root.
  const nodeIds = collectNodeIds(tree);
  const problems: string[] = [];
  for (const variant of experiment.variants as Variant[]) {
    for (const patch of variant.patches ?? []) {
      if (!nodeIds.has(patch.nodeId)) {
        problems.push(`variant "${variant.name}": node ${patch.nodeId} not in snapshot`);
      } else if (patch.op === "hide" && patch.nodeId === tree.id) {
        problems.push(`variant "${variant.name}": cannot hide the root node`);
      }
    }
  }
  if (problems.length > 0) {
    throw new SeamError(
      "EXPERIMENT_CONFLICT",
      409,
      "Experiment patches do not match the snapshot being published",
      { problems },
    );
  }
}

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

  // 2. If an experiment rides along, it must be active and its patches valid.
  if (body.experimentId) {
    await assertExperimentPublishable(projectId, body.experimentId, snapshot.tree as Node);
  }

  // 3. Create the publication and point the channel at it, atomically.
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(publications)
      .values({
        id: ulid(),
        screenId,
        snapshotId: body.snapshotId,
        experimentId: body.experimentId,
        channel: body.channel,
        isDefault: true,
        publishedBy: body.publishedBy,
      })
      .returning();
    await setChannelState(tx, screenId, body.channel, row.id);
    return row;
  });

  return c.json(serializeRow(created), 201);
});

// Promote: copy the active publication from one channel to another as a new
// immutable record (e.g. staging → production).
publicationsRouter.post("/promote", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  await findScreen(projectId, screenId);

  const body = parseBody(PromotePublicationSchema, await c.req.json());
  if (body.from === body.to) {
    throw new SeamError("INVALID_SCHEMA", 422, "Cannot promote a channel to itself");
  }

  const fromState = await getChannelState(screenId, body.from);
  if (!fromState) {
    throw new SeamError(
      "SCREEN_NOT_PUBLISHED",
      404,
      `Nothing is published on the "${body.from}" channel`,
    );
  }
  const source = await db.query.publications.findFirst({
    where: eq(publications.id, fromState.activePublicationId),
  });
  if (!source) {
    throw new SeamError("PUBLICATION_NOT_FOUND", 404, "Source publication not found");
  }

  // Re-validate the experiment at promote time — it may have been paused or
  // concluded since the source channel was published.
  if (source.experimentId) {
    const snapshot = await db.query.snapshots.findFirst({
      where: eq(snapshots.id, source.snapshotId),
    });
    if (!snapshot) throw new SeamError("SNAPSHOT_NOT_FOUND", 404, "Snapshot not found");
    await assertExperimentPublishable(projectId, source.experimentId, snapshot.tree as Node);
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(publications)
      .values({
        id: ulid(),
        screenId,
        snapshotId: source.snapshotId,
        experimentId: source.experimentId,
        channel: body.to,
        isDefault: true,
        publishedBy: body.publishedBy,
      })
      .returning();
    await setChannelState(tx, screenId, body.to, row.id);
    return row;
  });

  return c.json(serializeRow(created), 201);
});

publicationsRouter.get("/", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  await findScreen(projectId, screenId);

  const channelFilter = c.req.query("channel");
  let where = eq(publications.screenId, screenId);
  if (channelFilter) {
    const parsed = ChannelSchema.safeParse(channelFilter);
    if (!parsed.success) {
      throw new SeamError("INVALID_SCHEMA", 422, `Unknown channel "${channelFilter}"`);
    }
    where = and(where, eq(publications.channel, parsed.data)) ?? where;
  }

  const all = await db.query.publications.findMany({
    where,
    orderBy: [desc(publications.publishedAt)],
  });
  return c.json(serializeRows(all));
});

// Rollback: re-point this publication's channel at the previous publication
// on the same channel. The record itself stays — archived, not removed.
// If no previous publication exists, the channel becomes unpublished.
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
        eq(publications.channel, publication.channel),
        lt(publications.publishedAt, publication.publishedAt),
      ),
      orderBy: [desc(publications.publishedAt)],
    });
    await setChannelState(tx, screenId, publication.channel, previous?.id ?? null);
  });

  return c.body(null, 204);
});
