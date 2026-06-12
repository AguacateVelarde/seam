import { z } from "zod";
import { NodeSchema } from "./node";

export const SeamResponseSchema = z.object({
  screen: z.string(),
  snapshot: z.string(),
  version: z.number(),
  experiment: z
    .object({
      id: z.string(),
      variant: z.string(),
    })
    .optional(),
  tree: NodeSchema,
  meta: z.object({
    servedAt: z.string().datetime(),
    contentType: z.string(),
  }),
});

export type SeamResponse = z.infer<typeof SeamResponseSchema>;
