import { describe, expect, test } from "bun:test";
import { ulid } from "ulid";
import { ActionSchema, ComponentSchema, ExperimentSchema, NodeSchema, slugifyPath } from "./index";

describe("NodeSchema", () => {
  test("accepts a recursive tree with slots and conditions", () => {
    const tree = {
      id: ulid(),
      component: "Card",
      props: {
        title: { type: "static", value: "Hi" },
        name: { type: "binding", expression: "{{ user.name }}" },
        onTap: { type: "action", actionName: "navigation.push", params: { route: "/x" } },
      },
      slots: {
        body: [{ id: ulid(), component: "Text", props: {} }],
      },
      conditions: [{ expression: "{{ user.is_premium }}", operator: "show" }],
    };
    expect(NodeSchema.safeParse(tree).success).toBe(true);
  });

  test("rejects non-ULID ids and empty component names", () => {
    expect(NodeSchema.safeParse({ id: "nope", component: "Card", props: {} }).success).toBe(false);
    expect(NodeSchema.safeParse({ id: ulid(), component: "", props: {} }).success).toBe(false);
  });
});

describe("naming rules", () => {
  test("component names must be PascalCase", () => {
    const base = {
      id: ulid(),
      projectId: ulid(),
      props: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(ComponentSchema.safeParse({ ...base, name: "HeroCard" }).success).toBe(true);
    expect(ComponentSchema.safeParse({ ...base, name: "heroCard" }).success).toBe(false);
    expect(ComponentSchema.safeParse({ ...base, name: "Hero_Card" }).success).toBe(false);
  });

  test("action names must be namespace.verb", () => {
    const base = {
      id: ulid(),
      projectId: ulid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(ActionSchema.safeParse({ ...base, name: "navigation.push" }).success).toBe(true);
    expect(ActionSchema.safeParse({ ...base, name: "Navigation.Push" }).success).toBe(false);
    expect(ActionSchema.safeParse({ ...base, name: "push" }).success).toBe(false);
  });
});

describe("ExperimentSchema", () => {
  const base = {
    id: ulid(),
    projectId: ulid(),
    name: "exp",
    strategy: { type: "user_id", header: "X-User-Id", sticky: true },
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const variant = (weight: number) => ({
    id: ulid(),
    name: `v${weight}`,
    weight,
    snapshotId: ulid(),
  });

  test("requires variant weights to sum to 1.0", () => {
    expect(
      ExperimentSchema.safeParse({ ...base, variants: [variant(0.5), variant(0.5)] }).success,
    ).toBe(true);
    expect(
      ExperimentSchema.safeParse({ ...base, variants: [variant(0.5), variant(0.3)] }).success,
    ).toBe(false);
  });

  test("requires at least two variants", () => {
    expect(ExperimentSchema.safeParse({ ...base, variants: [variant(1)] }).success).toBe(false);
  });
});

describe("slugifyPath", () => {
  test("lowercases and hyphenates", () => {
    expect(slugifyPath("Home Page")).toBe("home-page");
    expect(slugifyPath("  Credit / Detail  ")).toBe("credit-detail");
    expect(slugifyPath("already-slugged")).toBe("already-slugged");
  });
});
