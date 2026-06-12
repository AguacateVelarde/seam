import type { Node } from "@seam/schema";

// Walk a UIDL tree depth-first, visiting every node.
export function walkTree(node: Node, visit: (node: Node) => void): void {
  visit(node);
  if (node.slots) {
    for (const children of Object.values(node.slots)) {
      for (const child of children) walkTree(child, visit);
    }
  }
}

export function treeUsesComponent(tree: Node, componentName: string): boolean {
  let found = false;
  walkTree(tree, (node) => {
    if (node.component === componentName) found = true;
  });
  return found;
}
