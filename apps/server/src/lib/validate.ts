import type { z } from "zod";
import { invalidSchema } from "./errors";

// Parse a request body against a Zod schema, throwing a 422 INVALID_SCHEMA
// SeamError (with the Zod issues in meta) on failure.
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw invalidSchema(result.error);
  return result.data;
}
