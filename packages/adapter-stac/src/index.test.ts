import { describe, expect, test } from "bun:test";
import type { SeamResponse } from "@seam/schema";
import { StacAdapter } from "./index";

const response: SeamResponse = {
  screen: "home",
  snapshot: "01JBXW5CSAH8YJ3GVKQZJ5W7P0",
  version: 3,
  tree: {
    id: "01JBXW5CSAH8YJ3GVKQZJ5W7P1",
    component: "Card",
    props: {
      title: { type: "static", value: "Hello" },
      subtitle: { type: "binding", expression: "{{ user.name }}" },
      onTap: { type: "action", actionName: "navigation.push", params: { route: "/detail" } },
    },
    slots: {
      body: [
        {
          id: "01JBXW5CSAH8YJ3GVKQZJ5W7P2",
          component: "Text",
          props: { text: { type: "static", value: "World" } },
        },
      ],
    },
  },
  meta: { servedAt: "2026-01-01T00:00:00.000Z", contentType: "application/vnd.seam.stac+json" },
};

describe("StacAdapter", () => {
  const adapter = new StacAdapter();

  test("exposes the vnd.seam.stac content type", () => {
    expect(adapter.name).toBe("stac");
    expect(adapter.contentType).toBe("application/vnd.seam.stac+json");
  });

  test("maps component→type, props→data and flattens slots into children", () => {
    const result = adapter.transform(response) as {
      version: string;
      screen: string;
      content: { type: string; data: Record<string, unknown>; children?: unknown[] };
    };
    expect(result.version).toBe("1.0");
    expect(result.screen).toBe("home");
    expect(result.content.type).toBe("Card");
    expect(result.content.data.title).toBe("Hello");
    expect(result.content.data.subtitle).toBe("${{{ user.name }}}");
    expect(result.content.data.onTap).toEqual({
      action: "navigation.push",
      params: { route: "/detail" },
    });
    expect(result.content.children).toHaveLength(1);
  });
});
