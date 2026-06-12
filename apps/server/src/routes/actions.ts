import { CreateActionSchema, UpdateActionSchema } from "@seam/schema";
import { and, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulid";
import { db } from "../db/client";
import { actions } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { isUniqueViolation } from "../lib/pg-errors";
import { serializeRow, serializeRows } from "../lib/serialize";
import { parseBody } from "../lib/validate";
import { type AuthEnv, requireProjectAccess } from "../middleware/auth";

export const actionsRouter = new Hono<AuthEnv>();

actionsRouter.use("*", requireProjectAccess("member"));

async function findAction(projectId: string, actionId: string) {
  const action = await db.query.actions.findFirst({
    where: and(eq(actions.id, actionId), eq(actions.projectId, projectId)),
  });
  if (!action) throw new SeamError("ACTION_NOT_FOUND", 404, "Action not found");
  return action;
}

actionsRouter.post("/", async (c) => {
  const projectId = param(c, "projectId");
  const body = parseBody(CreateActionSchema, await c.req.json());
  try {
    const [created] = await db
      .insert(actions)
      .values({
        id: ulid(),
        projectId,
        name: body.name,
        description: body.description,
        params: body.params ?? {},
      })
      .returning();
    return c.json(serializeRow(created), 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new SeamError(
        "DUPLICATE_NAME",
        409,
        `An action named "${body.name}" already exists in this project`,
      );
    }
    throw err;
  }
});

actionsRouter.get("/", async (c) => {
  const projectId = param(c, "projectId");
  const search = c.req.query("search");
  const where = search
    ? and(eq(actions.projectId, projectId), ilike(actions.name, `%${search}%`))
    : eq(actions.projectId, projectId);
  const all = await db.query.actions.findMany({
    where,
    orderBy: (t, { asc }) => [asc(t.name)],
  });
  return c.json(serializeRows(all));
});

actionsRouter.get("/:actionId", async (c) => {
  const action = await findAction(param(c, "projectId"), param(c, "actionId"));
  return c.json(serializeRow(action));
});

actionsRouter.patch("/:actionId", async (c) => {
  const projectId = param(c, "projectId");
  const actionId = param(c, "actionId");
  await findAction(projectId, actionId);
  const body = parseBody(UpdateActionSchema, await c.req.json());
  const [updated] = await db
    .update(actions)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(actions.id, actionId))
    .returning();
  return c.json(serializeRow(updated));
});

actionsRouter.delete("/:actionId", async (c) => {
  const projectId = param(c, "projectId");
  const actionId = param(c, "actionId");
  await findAction(projectId, actionId);
  await db.delete(actions).where(eq(actions.id, actionId));
  return c.body(null, 204);
});
