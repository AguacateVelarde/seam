import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { Fragment } from "react";
import { cx } from "../../lib/cx";
import type { Component, Node, PropValue } from "../../lib/types";
import { useEditorStore } from "../../store/editor";
import type { CanvasDragData, CanvasDropData } from "./canvasDnd";
import { slotDroppableId, useCanvasDnd } from "./canvasDnd";

const MAX_PROP_VIZ = 4;
const IMAGE_NAME_RE = /image|img|photo|avatar|icon/i;
const SMALL_IMAGE_RE = /icon|avatar/i;

/* ------------------------- Prop wireframe heuristics ------------------------ */

function PropViz({
  name,
  value,
  schemaType,
}: {
  name: string;
  value: PropValue;
  schemaType?: string;
}) {
  if (value.type === "binding") {
    const expression = value.expression.trim();
    return (
      <span className="flex max-w-full items-center self-start rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] italic text-slate-500">
        <span className="truncate">
          {expression.startsWith("{{") ? expression : `{{ ${expression} }}`}
        </span>
      </span>
    );
  }

  if (value.type === "action") {
    return (
      <span className="flex max-w-full items-center self-start rounded-md bg-slate-200 px-3 py-1 text-[10px] font-medium text-slate-600">
        <span className="truncate">{value.actionName}</span>
      </span>
    );
  }

  const raw = value.value;
  const imageish = schemaType === "url" || IMAGE_NAME_RE.test(name);
  if (imageish) {
    const small = SMALL_IMAGE_RE.test(name);
    return (
      <div
        title={name}
        className={cx(
          "relative shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100",
          small ? "h-6 w-6" : "aspect-video w-full",
        )}
      >
        <svg
          className="absolute inset-0 h-full w-full text-slate-300"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line x1="0" y1="0" x2="100%" y2="100%" stroke="currentColor" strokeWidth="1" />
          <line x1="100%" y1="0" x2="0" y2="100%" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    );
  }

  if (schemaType === "boolean" || typeof raw === "boolean") {
    const on = raw === true || raw === "true";
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <span
          className={cx(
            "flex h-3.5 w-6 shrink-0 items-center rounded-full px-0.5",
            on ? "justify-end bg-blue-400" : "justify-start bg-slate-300",
          )}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white shadow-sm" />
        </span>
        <span className="truncate">{name}</span>
      </span>
    );
  }

  if (schemaType === "enum") {
    return (
      <span className="flex max-w-full items-center self-start rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
        <span className="truncate">
          {name}: {String(raw)}
        </span>
      </span>
    );
  }

  if (schemaType === "number" || typeof raw === "number") {
    return (
      <p className="truncate text-[10px] text-slate-500">
        {name}: {String(raw)}
      </p>
    );
  }

  // string / currency / fallback → single gray text line
  return <p className="truncate text-[11px] text-slate-400">{String(raw)}</p>;
}

/* -------------------------------- Slot region ------------------------------- */

function InsertionLine() {
  return <div className="pointer-events-none h-0.5 shrink-0 rounded-full bg-blue-500" />;
}

function SlotRegion({
  parentId,
  slot,
  nodes,
  readOnly,
  componentsByName,
}: {
  parentId: string;
  slot: string;
  nodes: Node[];
  readOnly: boolean;
  componentsByName: Map<string, Component>;
}) {
  const { indicator, forbidden, isDragging } = useCanvasDnd();
  const id = slotDroppableId(parentId, slot);
  const disabled = readOnly || forbidden.has(parentId);
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { kind: "slot", parentId, slot } satisfies CanvasDropData,
    disabled,
  });
  const insertionIndex = indicator?.slotId === id ? indicator.index : null;

  return (
    <div className="px-1.5 pb-1.5">
      <p className="select-none px-0.5 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
        {slot}
      </p>
      <div
        ref={setNodeRef}
        data-slot-children={id}
        className={cx(
          "flex flex-col gap-1.5 rounded-md border border-dashed p-1.5",
          isOver && !disabled ? "border-blue-400 bg-blue-50/40" : "border-slate-200",
          isDragging && disabled && "opacity-50",
        )}
      >
        {nodes.length === 0 && insertionIndex === null && (
          <p className="select-none py-2 text-center text-[10px] text-slate-400">Drop here</p>
        )}
        {nodes.map((child, childIndex) => (
          <Fragment key={child.id}>
            {insertionIndex === childIndex && <InsertionLine />}
            <WireBox
              node={child}
              isRoot={false}
              readOnly={readOnly}
              componentsByName={componentsByName}
            />
          </Fragment>
        ))}
        {insertionIndex === nodes.length && <InsertionLine />}
      </div>
    </div>
  );
}

/* --------------------------------- WireBox --------------------------------- */

export function WireBox({
  node,
  isRoot,
  readOnly,
  componentsByName,
}: {
  node: Node;
  isRoot: boolean;
  readOnly: boolean;
  componentsByName: Map<string, Component>;
}) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);
  const duplicateNode = useEditorStore((s) => s.duplicateNode);
  const removeNode = useEditorStore((s) => s.removeNode);
  const { activeNodeId } = useCanvasDnd();

  const component = componentsByName.get(node.component);
  const isSelected = !readOnly && selectedNodeId === node.id;
  const hasConditions = (node.conditions?.length ?? 0) > 0;
  const canDrag = !readOnly && !isRoot;

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `node:${node.id}`,
    data: { kind: "node", nodeId: node.id } satisfies CanvasDragData,
    disabled: !canDrag,
  });

  const propEntries = Object.entries(node.props);
  const visibleProps = propEntries.slice(0, MAX_PROP_VIZ);
  const hiddenCount = propEntries.length - visibleProps.length;

  // Slots from the component schema, plus any extra keys already on the node.
  const slotNames = Object.entries(component?.props ?? {})
    .filter(([, def]) => def.type === "slot")
    .map(([slotName]) => slotName);
  for (const slotName of Object.keys(node.slots ?? {})) {
    if (!slotNames.includes(slotName)) slotNames.push(slotName);
  }

  const hasBody = visibleProps.length > 0 || slotNames.length > 0;

  return (
    <div
      ref={setNodeRef}
      data-canvas-node
      onClick={(e) => {
        e.stopPropagation();
        if (!readOnly) selectNode(node.id);
      }}
      className={cx(
        "group/box rounded-md border border-slate-300 bg-white",
        isSelected && "ring-2 ring-blue-500",
        activeNodeId === node.id && "opacity-40",
      )}
    >
      {/* Header strip */}
      <div
        className={cx(
          "flex items-center gap-1 px-1.5 py-1",
          hasBody && "border-b border-slate-100",
        )}
      >
        {canDrag ? (
          <button
            type="button"
            {...listeners}
            {...attributes}
            title="Drag to move"
            className="shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
          >
            <GripVertical size={12} />
          </button>
        ) : (
          <span className="w-1 shrink-0" />
        )}
        <span className="min-w-0 truncate text-xs font-semibold text-slate-700">
          {node.component}
        </span>
        {hasConditions && (
          <span className="shrink-0 text-[10px] text-purple-500" title="Has conditions">
            ◆
          </span>
        )}
        {!readOnly && (
          <span
            className={cx(
              "ml-auto flex shrink-0 items-center gap-0.5 transition-opacity",
              isSelected ? "opacity-100" : "opacity-0 group-hover/box:opacity-100",
            )}
          >
            {!isRoot && (
              <button
                type="button"
                title="Duplicate"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateNode(node.id);
                }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Copy size={11} />
              </button>
            )}
            <button
              type="button"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                removeNode(node.id);
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={11} />
            </button>
          </span>
        )}
      </div>

      {/* Prop wireframes */}
      {visibleProps.length > 0 && (
        <div className="flex flex-col gap-1 px-2 py-1.5">
          {visibleProps.map(([name, value]) => (
            <PropViz
              key={name}
              name={name}
              value={value}
              schemaType={component?.props[name]?.type}
            />
          ))}
          {hiddenCount > 0 && <p className="text-[10px] text-slate-400">+{hiddenCount} more</p>}
        </div>
      )}

      {/* Slot drop regions */}
      {slotNames.map((slotName) => (
        <SlotRegion
          key={slotName}
          parentId={node.id}
          slot={slotName}
          nodes={node.slots?.[slotName] ?? []}
          readOnly={readOnly}
          componentsByName={componentsByName}
        />
      ))}
    </div>
  );
}
