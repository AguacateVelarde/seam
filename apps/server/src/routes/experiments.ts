import {
  CreateExperimentSchema,
  type ExperimentStatus,
  UpdateExperimentSchema,
  experimentStatusTransitions,
} from "@seam/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { experiments, publications, screenChannels, screens } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { serializeRow, serializeRows } from "../lib/serialize";
import { parseBody } from "../lib/validate";
import { type AuthEnv, requireProjectAccess } from "../middleware/auth";
import { stickyStore } from "../services/sticky-store";

export const experimentsRouter = new Hono<AuthEnv>();

experimentsRouter.use("*", requireProjectAccess("member"));

async function findExperiment(projectId: string, experimentId: string) {
  const experiment = await db.query.experiments.findFirst({
    where: and(eq(experiments.id, experimentId), eq(experiments.projectId, projectId)),
  });
  if (!experiment) throw new SeamError("EXPERIMENT_NOT_FOUND", 404, "Experiment not found");
  return experiment;
}

async function assertScreenInProject(projectId: string, screenId: string) {
  const screen = await db.query.screens.findFirst({
    where: and(eq(screens.id, screenId), eq(screens.projectId, projectId)),
  });
  if (!screen) throw new SeamError("SCREEN_NOT_FOUND", 404, "Target screen not found in project");
}

experimentsRouter.post("/", async (c) => {
  const projectId = param(c, "projectId");
  const body = parseBody(CreateExperimentSchema, await c.req.json());
  if (body.screenId) await assertScreenInProject(projectId, body.screenId);
  const [created] = await db
    .insert(experiments)
    .values({
      id: ulid(),
      projectId,
      screenId: body.screenId,
      name: body.name,
      strategy: body.strategy,
      variants: body.variants,
      status: "draft",
    })
    .returning();
  return c.json(serializeRow(created), 201);
});

experimentsRouter.get("/", async (c) => {
  const projectId = param(c, "projectId");
  const all = await db.query.experiments.findMany({
    where: eq(experiments.projectId, projectId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return c.json(serializeRows(all));
});

experimentsRouter.get("/:experimentId", async (c) => {
  const projectId = param(c, "projectId");
  const experiment = await findExperiment(projectId, param(c, "experimentId"));

  // Enrich with affected screens (screens with a channel-active publication
  // referencing this experiment) and sticky assignment counts.
  const affectedScreens = await db
    .select({
      id: screens.id,
      name: screens.name,
      path: screens.path,
      channel: screenChannels.channel,
    })
    .from(screenChannels)
    .innerJoin(screens, eq(screens.id, screenChannels.screenId))
    .innerJoin(publications, eq(publications.id, screenChannels.activePublicationId))
    .where(and(eq(screens.projectId, projectId), eq(publications.experimentId, experiment.id)));

  const assignmentCount = await stickyStore.count(`seam:ab:${experiment.id}:`);

  return c.json({ ...serializeRow(experiment), affectedScreens, assignmentCount });
});

experimentsRouter.patch("/:experimentId", async (c) => {
  const projectId = param(c, "projectId");
  const experimentId = param(c, "experimentId");
  const experiment = await findExperiment(projectId, experimentId);
  const body = parseBody(UpdateExperimentSchema, await c.req.json());

  // Status transitions: draft → active, active ⇄ paused, active|paused → concluded
  if (body.status && body.status !== experiment.status) {
    const allowed = experimentStatusTransitions[experiment.status as ExperimentStatus];
    if (!allowed.includes(body.status)) {
      throw new SeamError(
        "EXPERIMENT_CONFLICT",
        409,
        `Cannot transition experiment from "${experiment.status}" to "${body.status}"`,
      );
    }
  }

  // name, strategy, variants, target screen are only mutable while in draft.
  if (experiment.status !== "draft") {
    if (body.variants) {
      throw new SeamError(
        "EXPERIMENT_CONFLICT",
        409,
        "Variants can only be modified while the experiment is in draft status",
      );
    }
    if (body.strategy || body.name || body.screenId) {
      throw new SeamError(
        "EXPERIMENT_CONFLICT",
        409,
        "Name, strategy and target screen can only be modified while the experiment is in draft status",
      );
    }
  }

  if (body.screenId) await assertScreenInProject(projectId, body.screenId);

  const [updated] = await db
    .update(experiments)
    .set({
      ...(body.name ? { name: body.name } : {}),
      ...(body.screenId ? { screenId: body.screenId } : {}),
      ...(body.strategy ? { strategy: body.strategy } : {}),
      ...(body.variants ? { variants: body.variants } : {}),
      ...(body.status ? { status: body.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(experiments.id, experimentId))
    .returning();
  return c.json(serializeRow(updated));
});
