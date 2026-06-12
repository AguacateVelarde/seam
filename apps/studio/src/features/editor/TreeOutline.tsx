import { ArrowDown, ArrowUp, Copy, MoreVertical, Plus, Trash2 } from "lucide-react";
import { Dropdown } from "../../components/ui/Dropdown";
import { EmptyState } from "../../components/ui/EmptyState";
import { cx } from "../../lib/cx";
import type { Node } from "../../lib/types";
import { useEditorStore } from "../../store/editor";
import { CATALOG_SEARCH_INPUT_ID } from "./CatalogPanel";

function propSummary(node: Node): string {
  return Object.entries(node.props)
    .filter(([, value]) => value.type === "static" && typeof value.value === "string")
    .slice(0, 2)
    .map(([key, value]) => `${key}="${value.type === "static" ? String(value.value) : ""}"`)
    .join("  ");
}

function NodeRow({
  node,
  depth,
  parentId,
  slot,
  index,
  siblingCount,
  readOnly,
}: {
  node: Node;
  depth: number;
  parentId: string | null;
  slot: string | null;
  index: number;
  siblingCount: number;
  readOnly: boolean;
}) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);
  const moveNode = useEditorStore((s) => s.moveNode);
  const duplicateNode = useEditorStore((s) => s.duplicateNode);
  const removeNode = useEditorStore((s) => s.removeNode);

  const isSelected = !readOnly && selectedNodeId === node.id;
  const summary = propSummary(node);
  const hasConditions = (node.conditions?.length ?? 0) > 0;

  return (
    <>
      <div
        onClick={() => {
          if (!readOnly) selectNode(node.id);
        }}
        className={cx(
          "group flex items-center gap-2 rounded-md px-2 py-1.5",
          readOnly ? "cursor-default" : "cursor-pointer",
          isSelected ? "bg-blue-50 ring-1 ring-blue-200" : !readOnly && "hover:bg-slate-50",
        )}
        style={{ paddingLeft: depth * 18 + 8 }}
      >
        <span className="text-sm font-medium text-slate-800">{node.component}</span>
        {summary && (
          <span className="min-w-0 truncate font-mono text-xs text-slate-400">{summary}</span>
        )}
        {hasConditions && (
          <span className="shrink-0 text-xs text-purple-500" title="Has conditions">
            ◆
          </span>
        )}
        {!readOnly && (
          <span
            className="ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Dropdown
              trigger={
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <MoreVertical size={14} />
                </button>
              }
              items={[
                {
                  label: "Add child",
                  icon: <Plus size={13} />,
                  onSelect: () => {
                    selectNode(node.id);
                    setTimeout(() => {
                      document.getElementById(CATALOG_SEARCH_INPUT_ID)?.focus();
                    }, 0);
                  },
                },
                {
                  label: "Move up",
                  icon: <ArrowUp size={13} />,
                  disabled: parentId === null || slot === null || index === 0,
                  onSelect: () => {
                    if (parentId && slot) moveNode(node.id, parentId, slot, index - 1);
                  },
                },
                {
                  label: "Move down",
                  icon: <ArrowDown size={13} />,
                  disabled: parentId === null || slot === null || index >= siblingCount - 1,
                  onSelect: () => {
                    if (parentId && slot) moveNode(node.id, parentId, slot, index + 1);
                  },
                },
                {
                  label: "Duplicate",
                  icon: <Copy size={13} />,
                  disabled: parentId === null,
                  onSelect: () => duplicateNode(node.id),
                },
                {
                  label: "Delete",
                  icon: <Trash2 size={13} />,
                  danger: true,
                  onSelect: () => removeNode(node.id),
                },
              ]}
            />
          </span>
        )}
      </div>

      {Object.entries(node.slots ?? {}).map(([slotName, children]) =>
        children.length === 0 ? null : (
          <div key={slotName}>
            <div
              className="select-none px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              style={{ paddingLeft: (depth + 1) * 18 + 8 }}
            >
              {slotName}
            </div>
            {children.map((child, childIndex) => (
              <NodeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                parentId={node.id}
                slot={slotName}
                index={childIndex}
                siblingCount={children.length}
                readOnly={readOnly}
              />
            ))}
          </div>
        ),
      )}
    </>
  );
}

export function TreeOutline({ tree, readOnly }: { tree: Node | null; readOnly: boolean }) {
  if (!tree) {
    return (
      <div className="p-8">
        <EmptyState
          title="Empty screen"
          description="Add a component from the catalog on the left. The first component becomes the root of the tree."
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <NodeRow
        node={tree}
        depth={0}
        parentId={null}
        slot={null}
        index={0}
        siblingCount={1}
        readOnly={readOnly}
      />
    </div>
  );
}
