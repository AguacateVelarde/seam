import { z } from "zod";

export const ScreenSchema = z.object({
  id: z.string().ulid(),
  projectId: z.string().ulid(),
  name: z.string().min(1),
  path: z.string().min(1),
  description: z.string().nullish(),
  activePublicationId: z.string().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Screen = z.infer<typeof ScreenSchema>;

export const ScreenStatusSchema = z.enum(["published", "draft", "no_publication"]);
export type ScreenStatus = z.infer<typeof ScreenStatusSchema>;

// Screen list items are enriched with publication/experiment info
export const ScreenListItemSchema = ScreenSchema.extend({
  status: ScreenStatusSchema,
  activeVersion: z.number().int().positive().nullable(),
  activeExperiment: z.string().nullable(),
  lastPublishedAt: z.string().datetime().nullable(),
});

export type ScreenListItem = z.infer<typeof ScreenListItemSchema>;

export const CreateScreenSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  description: z.string().optional(),
});

export const UpdateScreenSchema = z.object({
  name: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  description: z.string().optional(),
});

// Slugify a screen path: lowercase, hyphens, no leading/trailing separators
export function slugifyPath(path: string): string {
  return path
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
