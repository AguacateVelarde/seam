import { type Node, SEAM_NATIVE_CONTENT_TYPE, type SeamResponse } from "@seam/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client";
import { screens, snapshots } from "../db/schema";
import { SeamError } from "../lib/errors";
import { param } from "../lib/params";
import { type AuthEnv, requireAuth, requireProjectAccess } from "../middleware/auth";
import { getAdapter, getAdapterByName, listAdapters } from "../services/adapter";
import { resolveScreen } from "../services/audience";

export const deliverRouter = new Hono<AuthEnv>();

// Resolve the negotiated content type from an Accept header value.
// Returns the native type for missing/wildcard/plain-JSON accepts; throws
// 406 ADAPTER_NOT_FOUND for unknown vnd.seam subtypes.
function negotiateContentType(accept: string | undefined): string {
  if (!accept) return SEAM_NATIVE_CONTENT_TYPE;
  const candidates = accept.split(",").map((part) => part.split(";")[0].trim());
  for (const candidate of candidates) {
    if (
      candidate === "*/*" ||
      candidate === "application/*" ||
      candidate === "application/json" ||
      candidate === SEAM_NATIVE_CONTENT_TYPE
    ) {
      return SEAM_NATIVE_CONTENT_TYPE;
    }
    if (candidate.startsWith("application/vnd.seam.")) {
      if (getAdapter(candidate)) return candidate;
      throw new SeamError("ADAPTER_NOT_FOUND", 406, `No adapter registered for "${candidate}"`, {
        available: [SEAM_NATIVE_CONTENT_TYPE, ...listAdapters()],
      });
    }
  }
  return SEAM_NATIVE_CONTENT_TYPE;
}

function buildSeamResponse(
  resolved: Awaited<ReturnType<typeof resolveScreen>>,
  contentType: string,
): SeamResponse {
  return {
    screen: resolved.screen.path,
    snapshot: resolved.snapshot.id,
    version: resolved.snapshot.version,
    experiment:
      resolved.experiment && resolved.variant
        ? { id: resolved.experiment.id, variant: resolved.variant.name }
        : undefined,
    tree: resolved.snapshot.tree as Node,
    meta: {
      servedAt: new Date().toISOString(),
      contentType,
    },
  };
}

deliverRouter.get("/:projectId/screens/:path", requireAuth("read"), async (c) => {
  const projectId = param(c, "projectId");
  // API keys are project-scoped: the key must belong to the requested project.
  if (c.get("projectId") !== projectId) {
    return c.json({ error: { code: "FORBIDDEN", message: "API key does not match project" } }, 403);
  }

  const contentType = negotiateContentType(c.req.header("Accept"));
  const userId = c.req.header("X-User-Id");
  const resolved = await resolveScreen(projectId, param(c, "path"), userId);
  const response = buildSeamResponse(resolved, contentType);

  c.header("X-Seam-Snapshot", response.snapshot);
  c.header("X-Seam-Version", String(response.version));
  if (resolved.experiment && resolved.variant) {
    c.header("X-Seam-Experiment", resolved.experiment.name);
    c.header("X-Seam-Variant", resolved.variant.name);
  }
  c.header("Content-Type", contentType);

  const adapter = getAdapter(contentType);
  const body = adapter ? adapter.transform(response) : response;
  return c.body(JSON.stringify(body), 200);
});

// Preview: admin-only, supports overrides for snapshot / user / variant / adapter.
deliverRouter.get(
  "/:projectId/screens/:path/preview",
  requireProjectAccess("member"),
  async (c) => {
    const projectId = param(c, "projectId");
    const path = param(c, "path");
    const { snapshotId, userId, variant: variantName, adapter: adapterName } = c.req.query();

    let contentType = SEAM_NATIVE_CONTENT_TYPE;
    if (adapterName && adapterName !== "native") {
      const adapter = getAdapterByName(adapterName);
      if (!adapter) {
        throw new SeamError("ADAPTER_NOT_FOUND", 406, `No adapter named "${adapterName}"`, {
          available: listAdapters(),
        });
      }
      contentType = adapter.contentType;
    } else {
      contentType = negotiateContentType(c.req.header("Accept"));
    }

    let response: SeamResponse;
    let experimentName: string | undefined;
    let resolvedVariantName: string | undefined;

    if (snapshotId) {
      // Force a specific snapshot — bypasses publication entirely.
      const screen = await db.query.screens.findFirst({
        where: and(eq(screens.projectId, projectId), eq(screens.path, path)),
      });
      if (!screen) throw new SeamError("SCREEN_NOT_FOUND", 404, `Screen "${path}" not found`);
      const snapshot = await db.query.snapshots.findFirst({
        where: and(eq(snapshots.id, snapshotId), eq(snapshots.screenId, screen.id)),
      });
      if (!snapshot) throw new SeamError("SNAPSHOT_NOT_FOUND", 404, "Snapshot not found");
      response = {
        screen: screen.path,
        snapshot: snapshot.id,
        version: snapshot.version,
        tree: snapshot.tree as Node,
        meta: { servedAt: new Date().toISOString(), contentType },
      };
    } else {
      const resolved = await resolveScreen(projectId, path, userId, { variantName });
      response = buildSeamResponse(resolved, contentType);
      experimentName = resolved.experiment?.name;
      resolvedVariantName = resolved.variant?.name;
    }

    const adapter = getAdapter(contentType);
    const payload = adapter ? adapter.transform(response) : response;

    // Equivalent curl command for the real delivery endpoint — handy to copy.
    const base = new URL(c.req.url);
    const curlParts = [
      `curl '${base.origin}/v1/deliver/${projectId}/screens/${path}'`,
      `-H 'X-Seam-Key: <your-read-key>'`,
      `-H 'Accept: ${contentType}'`,
    ];
    if (userId) curlParts.push(`-H 'X-User-Id: ${userId}'`);
    const curlCommand = curlParts.join(" \\\n  ");

    return c.json({
      curlCommand,
      experiment: experimentName,
      variant: resolvedVariantName,
      payload,
    });
  },
);
