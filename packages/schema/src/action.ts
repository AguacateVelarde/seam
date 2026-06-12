import { z } from "zod";

export const ActionParamSchema = z.object({
  type: z.enum(["string", "number", "boolean", "enum"]),
  values: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  description: z.string().optional(),
});

export type ActionParam = z.infer<typeof ActionParamSchema>;

// Convention: namespace.verb — e.g. "navigation.push", "sheet.open"
export const actionNameRegex = /^[a-z]+\.[a-z][a-zA-Z]*$/;

export const ActionSchema = z.object({
  id: z.string().ulid(),
  projectId: z.string().ulid(),
  name: z.string().regex(actionNameRegex, "Must be namespace.verb"),
  description: z.string().nullish(),
  params: z.record(z.string(), ActionParamSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Action = z.infer<typeof ActionSchema>;

export const CreateActionSchema = z.object({
  name: z.string().regex(actionNameRegex, "Must be namespace.verb"),
  description: z.string().optional(),
  params: z.record(z.string(), ActionParamSchema).optional(),
});

export const UpdateActionSchema = z.object({
  description: z.string().optional(),
  params: z.record(z.string(), ActionParamSchema).optional(),
});
