import { CreateComponentSchema, type Node, UpdateComponentSchema } from "@seam/schema";
import { and, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { components, publications, screenChannels, screens, snapshots } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { isUniqueViolation } from "../lib/pg-errors";
import { serializeRow, serializeRows } from "../lib/serialize";
import { treeUsesComponent } from "../lib/tree";
import { parseBody } from "../lib/validate";
import { type AuthEnv, requireProjectAccess } from "../middleware/auth";

export const componentsRouter = new Hono<AuthEnv>();

componentsRouter.use("*", requireProjectAccess("member"));

async function findComponent(projectId: string, componentId: string) {
  const component = await db.query.components.findFirst({
    where: and(eq(components.id, componentId), eq(components.projectId, projectId)),
  });
  if (!component) throw new SeamError("COMPONENT_NOT_FOUND", 404, "Component not found");
  return component;
}

componentsRouter.post("/", async (c) => {
  const projectId = param(c, "projectId");
  const body = parseBody(CreateComponentSchema, await c.req.json());
  try {
    const [created] = await db
      .insert(components)
      .values({
        id: ulid(),
        projectId,
        name: body.name,
        description: body.description,
        props: body.props,
      })
      .returning();
    return c.json(serializeRow(created), 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new SeamError(
        "DUPLICATE_NAME",
        409,
        `A component named "${body.name}" already exists in this project`,
      );
    }
    throw err;
  }
});

componentsRouter.get("/", async (c) => {
  const projectId = param(c, "projectId");
  const search = c.req.query("search");
  const where = search
    ? and(eq(components.projectId, projectId), ilike(components.name, `%${search}%`))
    : eq(components.projectId, projectId);
  const all = await db.query.components.findMany({
    where,
    orderBy: (t, { asc }) => [asc(t.name)],
  });
  return c.json(serializeRows(all));
});

componentsRouter.get("/:componentId", async (c) => {
  const component = await findComponent(param(c, "projectId"), param(c, "componentId"));
  return c.json(serializeRow(component));
});

componentsRouter.patch("/:componentId", async (c) => {
  const projectId = param(c, "projectId");
  const componentId = param(c, "componentId");
  await findComponent(projectId, componentId);
  // Renaming is not allowed — it would break published snapshots.
  const body = parseBody(UpdateComponentSchema, await c.req.json());
  const [updated] = await db
    .update(components)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(components.id, componentId))
    .returning();
  return c.json(serializeRow(updated));
});

componentsRouter.delete("/:componentId", async (c) => {
  const projectId = param(c, "projectId");
  const componentId = param(c, "componentId");
  const component = await findComponent(projectId, componentId);

  // Soft check: block deletion if the component is referenced in any
  // published snapshot (active on any channel of any screen).
  const publishedScreens = await db
    .select({ screenName: screens.name, tree: snapshots.tree })
    .from(screenChannels)
    .innerJoin(screens, eq(screens.id, screenChannels.screenId))
    .innerJoin(publications, eq(publications.id, screenChannels.activePublicationId))
    .innerJoin(snapshots, eq(snapshots.id, publications.snapshotId))
    .where(eq(screens.projectId, projectId));

  const affected = new Set(
    publishedScreens
      .filter((row) => treeUsesComponent(row.tree as Node, component.name))
      .map((row) => row.screenName),
  );

  if (affected.size > 0) {
    throw new SeamError(
      "COMPONENT_IN_USE",
      409,
      `Component "${component.name}" is used in ${affected.size} published screen(s)`,
      { affectedScreens: [...affected], count: affected.size },
    );
  }

  await db.delete(components).where(eq(components.id, componentId));
  return c.body(null, 204);
});
