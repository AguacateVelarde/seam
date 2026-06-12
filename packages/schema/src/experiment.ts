import { z } from "zod";
import { ConditionRuleSchema, PropValueSchema } from "./node";

export const AllocationStrategySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("user_id"),
    header: z.string().default("X-User-Id"),
    sticky: z.literal(true), // always sticky when user_id-based
  }),
  z.object({
    type: z.literal("percentage"),
    sticky: z.boolean().default(false),
    ttlDays: z.number().int().min(1).default(30),
  }),
]);

export type AllocationStrategy = z.infer<typeof AllocationStrategySchema>;

// A variant is a list of patches applied to the publication's base snapshot
// at delivery time. One tree stays the source of truth; variants describe
// deltas: hide a component, override prop values, or swap conditions.
// "Show only in variant B" = include the node in the base tree and hide it
// in every other variant (including control).
export const VariantPatchSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("hide"),
    nodeId: z.string().ulid(),
  }),
  z.object({
    op: z.literal("setProps"),
    nodeId: z.string().ulid(),
    // Shallow merge into the node's props — only the listed keys change.
    props: z.record(z.string(), PropValueSchema),
  }),
  z.object({
    op: z.literal("setConditions"),
    nodeId: z.string().ulid(),
    // Replaces the node's client-evaluated conditions entirely.
    conditions: z.array(ConditionRuleSchema),
  }),
]);

export type VariantPatch = z.infer<typeof VariantPatchSchema>;

export const VariantSchema = z.object({
  id: z.string().ulid(),
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  // Control variants have no patches.
  patches: z.array(VariantPatchSchema).default([]),
  // Legacy (pre-patch) variants referenced a full alternate snapshot.
  // Still resolved for old experiments; not accepted for new ones in Studio.
  snapshotId: z.string().ulid().optional(),
});

export type Variant = z.infer<typeof VariantSchema>;

export const ExperimentStatusSchema = z.enum(["draft", "active", "paused", "concluded"]);
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;

const VariantsSchema = z
  .array(VariantSchema)
  .min(2)
  .refine(
    (variants) => {
      const total = variants.reduce((sum, v) => sum + v.weight, 0);
      return Math.abs(total - 1) < 0.001;
    },
    { message: "Variant weights must sum to 1.0" },
  );

export const ExperimentSchema = z.object({
  id: z.string().ulid(),
  projectId: z.string().ulid(),
  name: z.string().min(1),
  // The screen this experiment targets — patches reference node ids from
  // that screen's snapshots. Used by Studio to drive the patch editor.
  screenId: z.string().ulid().nullish(),
  strategy: AllocationStrategySchema,
  variants: VariantsSchema,
  status: ExperimentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Experiment = z.infer<typeof ExperimentSchema>;

export const CreateExperimentSchema = z.object({
  name: z.string().min(1),
  screenId: z.string().ulid().optional(),
  strategy: AllocationStrategySchema,
  variants: VariantsSchema,
});

export const UpdateExperimentSchema = z.object({
  name: z.string().min(1).optional(),
  screenId: z.string().ulid().optional(),
  strategy: AllocationStrategySchema.optional(),
  variants: VariantsSchema.optional(),
  status: ExperimentStatusSchema.optional(),
});

// Legal status transitions:
// draft → active, active → paused, paused → active, active|paused → concluded
export const experimentStatusTransitions: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ["active"],
  active: ["paused", "concluded"],
  paused: ["active", "concluded"],
  concluded: [],
};
