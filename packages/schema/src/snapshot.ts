import { z } from "zod";
import { NodeSchema } from "./node";

export const SnapshotSchema = z.object({
  id: z.string().ulid(),
  screenId: z.string().ulid(),
  version: z.number().int().positive(),
  tree: NodeSchema,
  createdAt: z.string().datetime(),
  createdBy: z.string().nullish(),
});

// Snapshots are immutable — no update schema
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const CreateSnapshotSchema = z.object({
  tree: NodeSchema,
  createdBy: z.string().optional(),
});
