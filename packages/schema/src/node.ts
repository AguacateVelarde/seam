import { z } from "zod";

// Static, binding, or action prop value
export const PropValueSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("static"),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.object({
    type: z.literal("binding"),
    // Expression resolved on the client side using local context
    // e.g. "{{ user.credit_limit }}", "{{ product.name }}"
    expression: z.string(),
  }),
  z.object({
    type: z.literal("action"),
    actionName: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
]);

export type PropValue = z.infer<typeof PropValueSchema>;

// Condition for conditional rendering — evaluated on the client
export const ConditionRuleSchema = z.object({
  expression: z.string(), // e.g. "{{ user.is_premium }}"
  operator: z.enum(["show", "hide"]),
});

export type ConditionRule = z.infer<typeof ConditionRuleSchema>;

// Recursive Node definition
export type Node = {
  id: string;
  component: string;
  props: Record<string, PropValue>;
  slots?: Record<string, Node[]>;
  conditions?: ConditionRule[];
};

export const NodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.object({
    id: z.string().ulid(),
    component: z.string().min(1),
    props: z.record(z.string(), PropValueSchema),
    slots: z.record(z.string(), z.array(NodeSchema)).optional(),
    conditions: z.array(ConditionRuleSchema).optional(),
  }),
);
