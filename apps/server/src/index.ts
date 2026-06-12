import { DivKitAdapter } from "@seam/adapter-divkit";
import { StacAdapter } from "@seam/adapter-stac";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { openApiDocument } from "./docs/openapi";
import { errorHandler } from "./middleware/error";
import { actionsRouter } from "./routes/actions";
import { authRouter } from "./routes/auth";
import { componentsRouter } from "./routes/components";
import { deliverRouter } from "./routes/deliver";
import { experimentsRouter } from "./routes/experiments";
import { invitesRouter } from "./routes/invites";
import { keysRouter } from "./routes/keys";
import { projectsRouter } from "./routes/projects";
import { publicationsRouter } from "./routes/publications";
import { screensRouter } from "./routes/screens";
import { snapshotsRouter } from "./routes/snapshots";
import { workspacesRouter } from "./routes/workspaces";
import { registerAdapter } from "./services/adapter";

registerAdapter(new StacAdapter());
registerAdapter(new DivKitAdapter());

if (process.env.SEAM_AUTO_MIGRATE === "true") {
  const { runMigrations } = await import("./db/migrate");
  await runMigrations();
}

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Seam-Key", "X-User-Id"],
    exposeHeaders: ["X-Seam-Snapshot", "X-Seam-Version", "X-Seam-Experiment", "X-Seam-Variant"],
  }),
);
app.onError(errorHandler);

// Auth & workspaces (Studio sign-in, first-run setup, invites)
app.route("/v1/auth", authRouter);
app.route("/v1/workspaces", workspacesRouter);
app.route("/v1/invites", invitesRouter);

// Management API
app.route("/v1/projects", projectsRouter);
app.route("/v1/projects/:projectId/keys", keysRouter);
app.route("/v1/projects/:projectId/components", componentsRouter);
app.route("/v1/projects/:projectId/actions", actionsRouter);
app.route("/v1/projects/:projectId/screens", screensRouter);
app.route("/v1/projects/:projectId/screens/:screenId/snapshots", snapshotsRouter);
app.route("/v1/projects/:projectId/screens/:screenId/publications", publicationsRouter);
app.route("/v1/projects/:projectId/experiments", experimentsRouter);

// Delivery API
app.route("/v1/deliver", deliverRouter);

// API docs — OpenAPI 3.1 + Scalar UI
app.get("/v1/openapi.json", (c) => c.json(openApiDocument));
app.get("/v1/docs", (c) =>
  c.html(`<!doctype html>
<html>
  <head>
    <title>Seam API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/v1/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`),
);

app.get("/health", (c) => c.json({ ok: true }));

export default { port: Number(process.env.PORT) || 3000, fetch: app.fetch };
