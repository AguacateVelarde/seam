import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().ulid(),
  workspaceId: z.string().ulid().nullish(),
  name: z.string().min(1),
  description: z.string().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  // Required when creating via a user session; inferred for admin API keys.
  workspaceId: z.string().ulid().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
