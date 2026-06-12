import type { Node, VariantPatch } from "@seam/schema";

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

export function collectNodeIds(tree: Node): Set<string> {
  const ids = new Set<string>();
  walkTree(tree, (node) => ids.add(node.id));
  return ids;
}

// Apply variant patches to a base tree, returning a new tree (the input is
// not mutated). Patch semantics:
//  - hide:          the node (and its subtree) is removed from the output
//  - setProps:      shallow-merge — only the listed prop keys are replaced
//  - setConditions: the node's conditions array is replaced entirely
// Hiding the root yields null (an empty screen for that variant).
export function applyPatches(tree: Node, patches: VariantPatch[]): Node | null {
  if (patches.length === 0) return tree;

  const hidden = new Set<string>();
  const propOverrides = new Map<string, Node["props"]>();
  const conditionOverrides = new Map<string, NonNullable<Node["conditions"]>>();

  for (const patch of patches) {
    if (patch.op === "hide") hidden.add(patch.nodeId);
    if (patch.op === "setProps") {
      propOverrides.set(patch.nodeId, {
        ...propOverrides.get(patch.nodeId),
        ...patch.props,
      });
    }
    if (patch.op === "setConditions") conditionOverrides.set(patch.nodeId, patch.conditions);
  }

  function transform(node: Node): Node | null {
    if (hidden.has(node.id)) return null;

    const result: Node = { ...node };

    const props = propOverrides.get(node.id);
    if (props) result.props = { ...node.props, ...props };

    const conditions = conditionOverrides.get(node.id);
    if (conditions) result.conditions = conditions;

    if (node.slots) {
      const slots: Record<string, Node[]> = {};
      for (const [slot, children] of Object.entries(node.slots)) {
        slots[slot] = children
          .map((child) => transform(child))
          .filter((child): child is Node => child !== null);
      }
      result.slots = slots;
    }

    return result;
  }

  return transform(tree);
}
