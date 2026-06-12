import {
  type Channel,
  type ChannelState,
  CreateScreenSchema,
  UpdateScreenSchema,
  slugifyPath,
} from "@seam/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { experiments, publications, screens, snapshots } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { isUniqueViolation } from "../lib/pg-errors";
import { serializeRow } from "../lib/serialize";
import { parseBody } from "../lib/validate";
import { type AuthEnv, requireProjectAccess } from "../middleware/auth";
import { listChannelStates } from "../services/channels";

export const screensRouter = new Hono<AuthEnv>();

screensRouter.use("*", requireProjectAccess("member"));

export async function findScreen(projectId: string, screenId: string) {
  const screen = await db.query.screens.findFirst({
    where: and(eq(screens.id, screenId), eq(screens.projectId, projectId)),
  });
  if (!screen) throw new SeamError("SCREEN_NOT_FOUND", 404, "Screen not found");
  return screen;
}

// Enrich a screen row with per-channel publication state. The top-level
// status/activeVersion/activeExperiment/lastPublishedAt reflect production.
async function enrichScreen(screen: typeof screens.$inferSelect) {
  const hasSnapshots = await db.query.snapshots.findFirst({
    where: eq(snapshots.screenId, screen.id),
    columns: { id: true },
  });

  const channels: Record<Channel, ChannelState | null> = {
    development: null,
    staging: null,
    production: null,
  };

  const states = await listChannelStates(screen.id);
  for (const state of states) {
    const publication = await db.query.publications.findFirst({
      where: eq(publications.id, state.activePublicationId),
    });
    if (!publication) continue;
    const snapshot = await db.query.snapshots.findFirst({
      where: eq(snapshots.id, publication.snapshotId),
      columns: { version: true },
    });
    let experimentName: string | null = null;
    if (publication.experimentId) {
      const experiment = await db.query.experiments.findFirst({
        where: eq(experiments.id, publication.experimentId),
        columns: { name: true },
      });
      experimentName = experiment?.name ?? null;
    }
    channels[state.channel as Channel] = {
      publicationId: publication.id,
      snapshotId: publication.snapshotId,
      version: snapshot?.version ?? null,
      experiment: experimentName,
      publishedAt: publication.publishedAt.toISOString(),
    };
  }

  const production = channels.production;
  const status: "published" | "draft" | "no_publication" = production
    ? "published"
    : hasSnapshots
      ? "draft"
      : "no_publication";

  return {
    ...serializeRow(screen),
    status,
    activeVersion: production?.version ?? null,
    activeExperiment: production?.experiment ?? null,
    lastPublishedAt: production?.publishedAt ?? null,
    channels,
  };
}

screensRouter.post("/", async (c) => {
  const projectId = param(c, "projectId");
  const body = parseBody(CreateScreenSchema, await c.req.json());
  const path = slugifyPath(body.path);
  if (!path) throw new SeamError("INVALID_SCHEMA", 422, "Path must contain at least one character");
  try {
    const [created] = await db
      .insert(screens)
      .values({ id: ulid(), projectId, name: body.name, path, description: body.description })
      .returning();
    return c.json(await enrichScreen(created), 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new SeamError(
        "DUPLICATE_NAME",
        409,
        `A screen with path "${path}" already exists in this project`,
      );
    }
    throw err;
  }
});

screensRouter.get("/", async (c) => {
  const projectId = param(c, "projectId");
  const all = await db.query.screens.findMany({
    where: eq(screens.projectId, projectId),
    orderBy: (t, { asc }) => [asc(t.name)],
  });
  return c.json(await Promise.all(all.map(enrichScreen)));
});

screensRouter.get("/:screenId", async (c) => {
  const screen = await findScreen(param(c, "projectId"), param(c, "screenId"));
  return c.json(await enrichScreen(screen));
});

screensRouter.patch("/:screenId", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  await findScreen(projectId, screenId);
  const body = parseBody(UpdateScreenSchema, await c.req.json());
  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
  if (body.path) updates.path = slugifyPath(body.path);
  try {
    const [updated] = await db
      .update(screens)
      .set(updates)
      .where(eq(screens.id, screenId))
      .returning();
    return c.json(await enrichScreen(updated));
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new SeamError(
        "DUPLICATE_NAME",
        409,
        `A screen with path "${updates.path}" already exists in this project`,
      );
    }
    throw err;
  }
});

screensRouter.delete("/:screenId", async (c) => {
  const projectId = param(c, "projectId");
  const screenId = param(c, "screenId");
  await findScreen(projectId, screenId);
  await db.delete(screens).where(eq(screens.id, screenId));
  return c.body(null, 204);
});
