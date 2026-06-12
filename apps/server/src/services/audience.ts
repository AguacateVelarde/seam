import { createHash } from "node:crypto";
import type { AllocationStrategy, Node, Variant } from "@seam/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { experiments, publications, screens, snapshots } from "../db/schema";
import { SeamError } from "../lib/errors";
import { applyPatches } from "../lib/tree";

type SnapshotRow = typeof snapshots.$inferSelect;
type ExperimentRow = typeof experiments.$inferSelect;

export type ResolvedScreen = {
  screen: typeof screens.$inferSelect;
  snapshot: SnapshotRow;
  // The tree to serve: the snapshot's tree, with the variant's patches
  // applied when an experiment is active.
  tree: Node;
  experiment: ExperimentRow | null;
  variant: Variant | null;
};

export type ResolveOverrides = {
  // Force a specific variant by name (preview only)
  variantName?: string;
};

export async function resolveScreen(
  projectId: string,
  path: string,
  userId?: string,
  overrides?: ResolveOverrides,
): Promise<ResolvedScreen> {
  // 1. Find screen by projectId + path
  const screen = await db.query.screens.findFirst({
    where: and(eq(screens.projectId, projectId), eq(screens.path, path)),
  });
  if (!screen) throw new SeamError("SCREEN_NOT_FOUND", 404, `Screen "${path}" not found`);

  // 2. Find active publication
  const publication = screen.activePublicationId
    ? await db.query.publications.findFirst({
        where: eq(publications.id, screen.activePublicationId),
      })
    : null;
  if (!publication) {
    throw new SeamError("SCREEN_NOT_PUBLISHED", 404, `Screen "${path}" has no active publication`);
  }

  // 3. If no experiment, return default snapshot
  if (!publication.experimentId) {
    const snapshot = await getSnapshot(publication.snapshotId);
    return { screen, snapshot, tree: snapshot.tree as Node, experiment: null, variant: null };
  }

  // 4. Resolve experiment variant
  const experiment = await getExperiment(publication.experimentId);

  // A paused/concluded experiment falls back to the publication's default snapshot
  if (experiment.status !== "active") {
    const snapshot = await getSnapshot(publication.snapshotId);
    return { screen, snapshot, tree: snapshot.tree as Node, experiment: null, variant: null };
  }

  const variants = experiment.variants as Variant[];
  let variant: Variant;
  if (overrides?.variantName) {
    const forced = variants.find((v) => v.name === overrides.variantName);
    if (!forced) {
      throw new SeamError(
        "EXPERIMENT_NOT_FOUND",
        404,
        `Variant "${overrides.variantName}" not found in experiment "${experiment.name}"`,
      );
    }
    variant = forced;
  } else {
    variant = await resolveVariant(experiment, userId);
  }

  // Legacy variants reference a full alternate snapshot; patch-based variants
  // transform the publication's base snapshot at delivery time.
  if (variant.snapshotId) {
    const snapshot = await getSnapshot(variant.snapshotId);
    return { screen, snapshot, tree: snapshot.tree as Node, experiment, variant };
  }

  const snapshot = await getSnapshot(publication.snapshotId);
  const tree = applyPatches(snapshot.tree as Node, variant.patches ?? []);
  if (!tree) {
    // Patches removed the root — misconfigured experiment (publish-time
    // validation rejects this, but old data could still contain it).
    throw new SeamError("INTERNAL_ERROR", 500, "Variant patches removed the root node");
  }
  return { screen, snapshot, tree, experiment, variant };
}

export async function resolveVariant(experiment: ExperimentRow, userId?: string): Promise<Variant> {
  const strategy = experiment.strategy as AllocationStrategy;
  const variants = experiment.variants as Variant[];

  if (strategy.type === "user_id" && userId) {
    // Deterministic hash: no storage needed, always same result for same user+experiment
    const hash = createHash("sha256").update(`${experiment.id}:${userId}`).digest("hex");
    const bucket = Number.parseInt(hash.slice(0, 8), 16) / 0xffffffff; // 0..1
    return pickVariantByBucket(variants, bucket);
  }

  if (strategy.type === "percentage") {
    const { stickyStore } = await import("./sticky-store");
    if (strategy.sticky && userId) {
      // Check the sticky store for an existing assignment
      const cached = await stickyStore.get(`seam:ab:${experiment.id}:${userId}`);
      if (cached) {
        const found = variants.find((v) => v.id === cached);
        if (found) return found;
      }
      // Assign and store with TTL
      const bucket = Math.random();
      const variant = pickVariantByBucket(variants, bucket);
      await stickyStore.setex(
        `seam:ab:${experiment.id}:${userId}`,
        strategy.ttlDays * 86400,
        variant.id,
      );
      return variant;
    }
    // Non-sticky: pure random each request
    return pickVariantByBucket(variants, Math.random());
  }

  // Fallback: first variant
  return variants[0];
}

export function pickVariantByBucket(variants: Variant[], bucket: number): Variant {
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (bucket <= cumulative) return variant;
  }
  return variants[variants.length - 1];
}

export async function getSnapshot(snapshotId: string): Promise<SnapshotRow> {
  const snapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.id, snapshotId),
  });
  if (!snapshot) throw new SeamError("SNAPSHOT_NOT_FOUND", 404, "Snapshot not found");
  return snapshot;
}

export async function getExperiment(experimentId: string): Promise<ExperimentRow> {
  const experiment = await db.query.experiments.findFirst({
    where: eq(experiments.id, experimentId),
  });
  if (!experiment) throw new SeamError("EXPERIMENT_NOT_FOUND", 404, "Experiment not found");
  return experiment;
}
