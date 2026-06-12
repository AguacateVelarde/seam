import type { Node, PropValue, SeamAdapter, SeamResponse } from "@seam/schema";

export class DivKitAdapter implements SeamAdapter {
  name = "divkit";
  contentType = "application/vnd.seam.divkit+json";

  transform(response: SeamResponse): unknown {
    return {
      card: {
        log_id: response.screen,
        states: [
          {
            state_id: 0,
            div: this.transformNode(response.tree),
          },
        ],
      },
    };
  }

  private transformNode(node: Node): Record<string, unknown> {
    // DivKit uses "type" for the component kind and inlines props on the div.
    // Slot children are flattened into "items".
    const div: Record<string, unknown> = {
      type: node.component,
    };

    for (const [key, val] of Object.entries(node.props)) {
      div[key] = this.transformPropValue(val);
    }

    if (node.slots) {
      const items = Object.values(node.slots)
        .flat()
        .map((child) => this.transformNode(child));
      if (items.length > 0) div.items = items;
    }

    return div;
  }

  private transformPropValue(prop: PropValue): unknown {
    if (prop.type === "static") return prop.value;
    // DivKit expression syntax: @{expression}
    if (prop.type === "binding") return `@{${stripMustache(prop.expression)}}`;
    if (prop.type === "action") {
      return {
        log_id: prop.actionName,
        url: `seam-action://${prop.actionName}`,
        payload: prop.params ?? {},
      };
    }
    return null;
  }
}

function stripMustache(expression: string): string {
  const match = expression.match(/^\{\{\s*(.*?)\s*\}\}$/);
  return match ? match[1] : expression;
}
