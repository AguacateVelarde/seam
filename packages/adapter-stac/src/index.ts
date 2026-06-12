import type { Node, PropValue, SeamAdapter, SeamResponse } from "@seam/schema";

export class StacAdapter implements SeamAdapter {
  name = "stac";
  contentType = "application/vnd.seam.stac+json";

  transform(response: SeamResponse): unknown {
    return {
      version: "1.0",
      screen: response.screen,
      content: this.transformNode(response.tree),
    };
  }

  private transformNode(node: Node): unknown {
    // Map Seam node structure to Stac JSON format.
    // Stac uses "type" instead of "component", and "data" instead of "props".
    return {
      type: node.component,
      data: Object.fromEntries(
        Object.entries(node.props).map(([key, val]) => [key, this.transformPropValue(val)]),
      ),
      children: node.slots
        ? Object.values(node.slots)
            .flat()
            .map((child) => this.transformNode(child))
        : undefined,
    };
  }

  private transformPropValue(prop: PropValue): unknown {
    if (prop.type === "static") return prop.value;
    if (prop.type === "binding") return `\${${prop.expression}}`;
    if (prop.type === "action") return { action: prop.actionName, params: prop.params };
    return null;
  }
}
