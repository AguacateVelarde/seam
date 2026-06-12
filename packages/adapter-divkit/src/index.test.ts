import { describe, expect, test } from "bun:test";
import type { SeamResponse } from "@seam/schema";
import { DivKitAdapter } from "./index";

const response: SeamResponse = {
  screen: "home",
  snapshot: "01JBXW5CSAH8YJ3GVKQZJ5W7P0",
  version: 1,
  tree: {
    id: "01JBXW5CSAH8YJ3GVKQZJ5W7P1",
    component: "container",
    props: {
      orientation: { type: "static", value: "vertical" },
      title: { type: "binding", expression: "{{ user.name }}" },
    },
    slots: {
      items: [
        {
          id: "01JBXW5CSAH8YJ3GVKQZJ5W7P2",
          component: "text",
          props: { text: { type: "static", value: "Hi" } },
        },
      ],
    },
  },
  meta: { servedAt: "2026-01-01T00:00:00.000Z", contentType: "application/vnd.seam.divkit+json" },
};

describe("DivKitAdapter", () => {
  const adapter = new DivKitAdapter();

  test("wraps the tree in a DivKit card with one state", () => {
    const result = adapter.transform(response) as {
      card: { log_id: string; states: { state_id: number; div: Record<string, unknown> }[] };
    };
    expect(result.card.log_id).toBe("home");
    expect(result.card.states).toHaveLength(1);
    const div = result.card.states[0].div;
    expect(div.type).toBe("container");
    expect(div.orientation).toBe("vertical");
    expect(div.title).toBe("@{user.name}");
    expect((div.items as unknown[]).length).toBe(1);
  });
});
