import { z } from "zod";

export const PropTypeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("string") }),
  z.object({ type: z.literal("number") }),
  z.object({ type: z.literal("boolean") }),
  z.object({ type: z.literal("currency") }),
  z.object({ type: z.literal("url") }),
  z.object({ type: z.literal("action") }),
  z.object({ type: z.literal("enum"), values: z.array(z.string()).min(1) }),
  z.object({ type: z.literal("slot") }),
]);

export type PropType = z.infer<typeof PropTypeSchema>;

export const ComponentPropSchema = PropTypeSchema.and(
  z.object({
    required: z.boolean().default(false),
    defaultValue: z.unknown().optional(),
    description: z.string().optional(),
  }),
);

export type ComponentProp = z.infer<typeof ComponentPropSchema>;

export const componentNameRegex = /^[A-Z][a-zA-Z0-9]*$/;

export const ComponentSchema = z.object({
  id: z.string().ulid(),
  projectId: z.string().ulid(),
  name: z.string().regex(componentNameRegex, "Must be PascalCase"),
  description: z.string().nullish(),
  props: z.record(z.string(), ComponentPropSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Component = z.infer<typeof ComponentSchema>;

export const CreateComponentSchema = z.object({
  name: z.string().regex(componentNameRegex, "Must be PascalCase"),
  description: z.string().optional(),
  props: z.record(z.string(), ComponentPropSchema).default({}),
});

// Renaming a component is a breaking change for published snapshots — not allowed.
export const UpdateComponentSchema = z.object({
  description: z.string().optional(),
  props: z.record(z.string(), ComponentPropSchema).optional(),
});
