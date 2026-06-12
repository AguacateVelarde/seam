import { describe, expect, test } from "bun:test";
import type { Node, VariantPatch } from "@seam/schema";
import { applyPatches, collectNodeIds } from "./tree";

const ROOT = "01JBXW5CSAH8YJ3GVKQZJ5W7R0";
const CARD = "01JBXW5CSAH8YJ3GVKQZJ5W7R1";
const BANNER = "01JBXW5CSAH8YJ3GVKQZJ5W7R2";
const TEXT = "01JBXW5CSAH8YJ3GVKQZJ5W7R3";

function baseTree(): Node {
  return {
    id: ROOT,
    component: "Page",
    props: {},
    slots: {
      body: [
        {
          id: CARD,
          component: "HeroCard",
          props: {
            title: { type: "static", value: "Welcome" },
            color: { type: "static", value: "blue" },
          },
          slots: {
            content: [{ id: TEXT, component: "Text", props: {} }],
          },
        },
        { id: BANNER, component: "PromoBanner", props: {} },
      ],
    },
  };
}

describe("applyPatches", () => {
  test("no patches returns the tree unchanged", () => {
    const tree = baseTree();
    expect(applyPatches(tree, [])).toBe(tree);
  });

  test("hide removes the node and its subtree", () => {
    const result = applyPatches(baseTree(), [{ op: "hide", nodeId: BANNER }]);
    const ids = collectNodeIds(result as Node);
    expect(ids.has(BANNER)).toBe(false);
    expect(ids.has(CARD)).toBe(true);
    expect(ids.has(TEXT)).toBe(true);
  });

  test("setProps merges only the listed keys", () => {
    const result = applyPatches(baseTree(), [
      { op: "setProps", nodeId: CARD, props: { color: { type: "static", value: "red" } } },
    ]) as Node;
    const card = result.slots?.body[0] as Node;
    expect(card.props.color).toEqual({ type: "static", value: "red" });
    expect(card.props.title).toEqual({ type: "static", value: "Welcome" });
  });

  test("setConditions replaces conditions", () => {
    const result = applyPatches(baseTree(), [
      {
        op: "setConditions",
        nodeId: BANNER,
        conditions: [{ expression: "{{ user.is_premium }}", operator: "show" }],
      },
    ]) as Node;
    const banner = result.slots?.body[1] as Node;
    expect(banner.conditions).toEqual([{ expression: "{{ user.is_premium }}", operator: "show" }]);
  });

  test("does not mutate the input tree", () => {
    const tree = baseTree();
    const patches: VariantPatch[] = [
      { op: "hide", nodeId: BANNER },
      { op: "setProps", nodeId: CARD, props: { color: { type: "static", value: "red" } } },
    ];
    applyPatches(tree, patches);
    expect(tree.slots?.body).toHaveLength(2);
    expect((tree.slots?.body[0] as Node).props.color).toEqual({ type: "static", value: "blue" });
  });

  test("hiding the root returns null", () => {
    expect(applyPatches(baseTree(), [{ op: "hide", nodeId: ROOT }])).toBeNull();
  });
});
