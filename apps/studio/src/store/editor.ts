import { ulid } from "ulid";
import { create } from "zustand";
import type { ConditionRule, Node, PropValue } from "../lib/types";

/* ----------------------------- Tree helpers ---------------------------- */

export function findNodeById(root: Node | null, id: string): Node | null {
  if (!root) return null;
  if (root.id === id) return root;
  for (const children of Object.values(root.slots ?? {})) {
    for (const child of children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

export interface NodeLocation {
  parent: Node;
  slot: string;
  index: number;
}

export function findNodeLocation(root: Node, id: string): NodeLocation | null {
  for (const [slot, children] of Object.entries(root.slots ?? {})) {
    const index = children.findIndex((c) => c.id === id);
    if (index !== -1) return { parent: root, slot, index };
    for (const child of children) {
      const found = findNodeLocation(child, id);
      if (found) return found;
    }
  }
  return null;
}

function cloneTree(tree: Node): Node {
  return structuredClone(tree);
}

function withNewIds(node: Node): Node {
  return {
    ...node,
    id: ulid(),
    props: structuredClone(node.props),
    conditions: node.conditions ? structuredClone(node.conditions) : undefined,
    slots: node.slots
      ? Object.fromEntries(
          Object.entries(node.slots).map(([slot, children]) => [slot, children.map(withNewIds)]),
        )
      : undefined,
  };
}

/* -------------------------------- Store -------------------------------- */

export type EditorStore = {
  tree: Node | null;
  selectedNodeId: string | null;
  isDirty: boolean;
  currentSnapshotVersion: number | null;
  setTree: (tree: Node) => void;
  selectNode: (id: string) => void;
  updateNodeProps: (id: string, props: Record<string, PropValue>) => void;
  addNode: (parentId: string | null, slot: string, component: string) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, newParentId: string, slot: string, index: number) => void;
  addCondition: (nodeId: string, condition: ConditionRule) => void;
  removeCondition: (nodeId: string, index: number) => void;
  // Extras beyond the core contract (loading/saving lifecycle + conveniences)
  updateCondition: (nodeId: string, index: number, condition: ConditionRule) => void;
  duplicateNode: (id: string) => void;
  loadSnapshot: (tree: Node | null, version: number | null) => void;
  markSaved: (version: number) => void;
  resetEditor: () => void;
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  tree: null,
  selectedNodeId: null,
  isDirty: false,
  currentSnapshotVersion: null,

  // Loads a tree as a dirty draft (used by "Restore this version")
  setTree: (tree) => set({ tree: cloneTree(tree), isDirty: true }),

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodeProps: (id, props) => {
    const { tree } = get();
    if (!tree) return;
    const next = cloneTree(tree);
    const node = findNodeById(next, id);
    if (!node) return;
    node.props = props;
    set({ tree: next, isDirty: true });
  },

  addNode: (parentId, slot, component) => {
    const { tree } = get();
    const newNode: Node = { id: ulid(), component, props: {} };
    if (!tree) {
      set({ tree: newNode, selectedNodeId: newNode.id, isDirty: true });
      return;
    }
    const next = cloneTree(tree);
    const parent = parentId ? findNodeById(next, parentId) : next;
    if (!parent) return;
    parent.slots = parent.slots ?? {};
    parent.slots[slot] = parent.slots[slot] ?? [];
    parent.slots[slot].push(newNode);
    set({ tree: next, selectedNodeId: newNode.id, isDirty: true });
  },

  removeNode: (id) => {
    const { tree, selectedNodeId } = get();
    if (!tree) return;
    if (tree.id === id) {
      set({ tree: null, selectedNodeId: null, isDirty: true });
      return;
    }
    const next = cloneTree(tree);
    const location = findNodeLocation(next, id);
    if (!location) return;
    location.parent.slots?.[location.slot]?.splice(location.index, 1);
    if (location.parent.slots && location.parent.slots[location.slot]?.length === 0) {
      delete location.parent.slots[location.slot];
      if (Object.keys(location.parent.slots).length === 0) {
        location.parent.slots = undefined;
      }
    }
    const stillSelected = selectedNodeId ? findNodeById(next, selectedNodeId) : null;
    set({ tree: next, selectedNodeId: stillSelected ? selectedNodeId : null, isDirty: true });
  },

  moveNode: (id, newParentId, slot, index) => {
    const { tree } = get();
    if (!tree || tree.id === id) return;
    const next = cloneTree(tree);
    const location = findNodeLocation(next, id);
    if (!location) return;
    const [node] = location.parent.slots?.[location.slot]?.splice(location.index, 1) ?? [];
    if (!node) return;
    const newParent = findNodeById(next, newParentId);
    if (!newParent) return;
    newParent.slots = newParent.slots ?? {};
    newParent.slots[slot] = newParent.slots[slot] ?? [];
    const target = newParent.slots[slot];
    target.splice(Math.max(0, Math.min(index, target.length)), 0, node);
    set({ tree: next, isDirty: true });
  },

  addCondition: (nodeId, condition) => {
    const { tree } = get();
    if (!tree) return;
    const next = cloneTree(tree);
    const node = findNodeById(next, nodeId);
    if (!node) return;
    node.conditions = [...(node.conditions ?? []), condition];
    set({ tree: next, isDirty: true });
  },

  removeCondition: (nodeId, index) => {
    const { tree } = get();
    if (!tree) return;
    const next = cloneTree(tree);
    const node = findNodeById(next, nodeId);
    if (!node?.conditions) return;
    node.conditions.splice(index, 1);
    if (node.conditions.length === 0) node.conditions = undefined;
    set({ tree: next, isDirty: true });
  },

  updateCondition: (nodeId, index, condition) => {
    const { tree } = get();
    if (!tree) return;
    const next = cloneTree(tree);
    const node = findNodeById(next, nodeId);
    if (!node?.conditions || index < 0 || index >= node.conditions.length) return;
    node.conditions[index] = condition;
    set({ tree: next, isDirty: true });
  },

  duplicateNode: (id) => {
    const { tree } = get();
    if (!tree || tree.id === id) return; // cannot duplicate the root
    const next = cloneTree(tree);
    const location = findNodeLocation(next, id);
    if (!location) return;
    const original = location.parent.slots?.[location.slot]?.[location.index];
    if (!original) return;
    const copy = withNewIds(original);
    location.parent.slots?.[location.slot]?.splice(location.index + 1, 0, copy);
    set({ tree: next, selectedNodeId: copy.id, isDirty: true });
  },

  loadSnapshot: (tree, version) =>
    set({
      tree: tree ? cloneTree(tree) : null,
      currentSnapshotVersion: version,
      isDirty: false,
      selectedNodeId: null,
    }),

  markSaved: (version) => set({ isDirty: false, currentSnapshotVersion: version }),

  resetEditor: () =>
    set({ tree: null, selectedNodeId: null, isDirty: false, currentSnapshotVersion: null }),
}));
