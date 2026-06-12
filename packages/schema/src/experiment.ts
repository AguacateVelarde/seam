import { z } from "zod";

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

export const VariantSchema = z.object({
  id: z.string().ulid(),
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  snapshotId: z.string().ulid(),
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
  strategy: AllocationStrategySchema,
  variants: VariantsSchema,
  status: ExperimentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Experiment = z.infer<typeof ExperimentSchema>;

export const CreateExperimentSchema = z.object({
  name: z.string().min(1),
  strategy: AllocationStrategySchema,
  variants: VariantsSchema,
});

export const UpdateExperimentSchema = z.object({
  name: z.string().min(1).optional(),
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
