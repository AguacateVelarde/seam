import { z } from "zod";

export const PublicationSchema = z.object({
  id: z.string().ulid(),
  screenId: z.string().ulid(),
  snapshotId: z.string().ulid(),
  experimentId: z.string().ulid().nullish(),
  isDefault: z.boolean().default(false),
  publishedAt: z.string().datetime(),
  publishedBy: z.string().nullish(),
});

export type Publication = z.infer<typeof PublicationSchema>;

export const CreatePublicationSchema = z.object({
  snapshotId: z.string().ulid(),
  experimentId: z.string().ulid().optional(),
  publishedBy: z.string().optional(),
});
