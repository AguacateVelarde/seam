import type { CollisionDetection } from "@dnd-kit/core";
import { pointerWithin, rectIntersection } from "@dnd-kit/core";
import { createContext, useContext } from "react";
import type { Node } from "../../lib/types";

/* ------------------------------ Drag payloads ----------------------------- */

/** Payload attached to draggable sources (catalog rows + canvas boxes). */
export type CanvasDragData =
  | { kind: "catalog"; componentName: string }
  | { kind: "node"; nodeId: string };

/** Payload attached to droppable regions (slot areas + empty-tree zone). */
export type CanvasDropData = { kind: "slot"; parentId: string; slot: string } | { kind: "root" };

/** Where the blue insertion line should render while dragging. */
export interface DropIndicator {
  slotId: string;
  index: number;
}

/** Resolved drop destination (parentId === null means "set as root"). */
export interface DropTarget {
  parentId: string | null;
  slot: string;
  index: number;
}

export const ROOT_DROPPABLE_ID = "canvas-root-dropzone";

export function slotDroppableId(parentId: string, slot: string): string {
  return `slot:${parentId}:${slot}`;
}

/** Collects the id of a node and all of its descendants (the forbidden drop set). */
export function collectNodeIds(node: Node, into: Set<string> = new Set()): Set<string> {
  into.add(node.id);
  for (const children of Object.values(node.slots ?? {})) {
    for (const child of children) collectNodeIds(child, into);
  }
  return into;
}

export const EMPTY_NODE_SET: ReadonlySet<string> = new Set();

/* ------------------------------ React context ----------------------------- */

export interface CanvasDndState {
  indicator: DropIndicator | null;
  /** Ids of the dragged node + its descendants — slots inside are disabled. */
  forbidden: ReadonlySet<string>;
  /** Id of the canvas node currently being dragged (dimmed in place). */
  activeNodeId: string | null;
  isDragging: boolean;
}

export const CanvasDndContext = createContext<CanvasDndState>({
  indicator: null,
  forbidden: EMPTY_NODE_SET,
  activeNodeId: null,
  isDragging: false,
});

export function useCanvasDnd(): CanvasDndState {
  return useContext(CanvasDndContext);
}

/* ---------------------------- Collision strategy --------------------------- */

/**
 * pointerWithin with a "smallest rect wins" tiebreak so deeply nested slot
 * regions take precedence over their ancestors; falls back to rectIntersection
 * when the pointer is outside every droppable (e.g. fast drags).
 */
export const canvasCollisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length === 0) return rectIntersection(args);
  if (hits.length === 1) return hits;
  return hits.slice().sort((a, b) => {
    const rectA = args.droppableRects.get(a.id);
    const rectB = args.droppableRects.get(b.id);
    const areaA = rectA ? rectA.width * rectA.height : Number.POSITIVE_INFINITY;
    const areaB = rectB ? rectB.width * rectB.height : Number.POSITIVE_INFINITY;
    return areaA - areaB;
  });
};
