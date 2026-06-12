import { Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Segmented } from "../../components/ui/Segmented";
import { Switch } from "../../components/ui/Switch";
import { cx } from "../../lib/cx";
import { shortId } from "../../lib/format";
import type { Node, PropValue, VariantPatch } from "../../lib/types";

/* ------------------------------- Helpers ------------------------------- */

/** Flatten a snapshot tree into a nodeId → node lookup. */
export function indexNodes(tree: Node | null | undefined): Map<string, Node> {
  const map = new Map<string, Node>();
  function walk(node: Node) {
    map.set(node.id, node);
    for (const children of Object.values(node.slots ?? {})) {
      for (const child of children) walk(child);
    }
  }
  if (tree) walk(tree);
  return map;
}

/** e.g. "3 patches — hide 1, props 2" */
export function summarizePatches(patches: VariantPatch[]): string {
  if (patches.length === 0) return "no patches";
  const counts = { hide: 0, setProps: 0, setConditions: 0 };
  for (const patch of patches) counts[patch.op] += 1;
  const parts: string[] = [];
  if (counts.hide) parts.push(`hide ${counts.hide}`);
  if (counts.setProps) parts.push(`props ${counts.setProps}`);
  if (counts.setConditions) parts.push(`conditions ${counts.setConditions}`);
  return `${patches.length} ${patches.length === 1 ? "patch" : "patches"} — ${parts.join(", ")}`;
}

/** e.g. "hide Banner" / "Hero: override title, color" */
export function describePatch(patch: VariantPatch, nodeIndex: Map<string, Node>): string {
  const label = nodeIndex.get(patch.nodeId)?.component ?? shortId(patch.nodeId, 10);
  switch (patch.op) {
    case "hide":
      return `hide ${label}`;
    case "setProps":
      return `${label}: override ${Object.keys(patch.props).join(", ")}`;
    case "setConditions":
      return `${label}: replace conditions (${patch.conditions.length})`;
  }
}

/* -------------------------- Props override dialog -------------------------- */

interface PropDraft {
  include: boolean;
  mode: "static" | "binding";
  staticKind: "string" | "number" | "boolean";
  text: string;
  bool: boolean;
  expression: string;
}

function staticKindOf(value: string | number | boolean): PropDraft["staticKind"] {
  return typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string";
}

function initDraft(current: PropValue, override: PropValue | undefined): PropDraft {
  const draft: PropDraft = {
    include: override !== undefined,
    mode: current.type === "binding" ? "binding" : "static",
    staticKind: current.type === "static" ? staticKindOf(current.value) : "string",
    text:
      current.type === "static" && typeof current.value !== "boolean" ? String(current.value) : "",
    bool: current.type === "static" && typeof current.value === "boolean" ? current.value : false,
    expression: current.type === "binding" ? current.expression : "",
  };
  if (override?.type === "static") {
    draft.mode = "static";
    draft.staticKind = staticKindOf(override.value);
    if (typeof override.value === "boolean") draft.bool = override.value;
    else draft.text = String(override.value);
  } else if (override?.type === "binding") {
    draft.mode = "binding";
    draft.expression = override.expression;
  }
  return draft;
}

function PropsOverrideDialog({
  node,
  existing,
  onClose,
  onSave,
}: {
  node: Node;
  existing: Record<string, PropValue> | undefined;
  onClose: () => void;
  onSave: (props: Record<string, PropValue>) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, PropDraft>>(() => {
    const out: Record<string, PropDraft> = {};
    for (const [name, current] of Object.entries(node.props)) {
      out[name] = initDraft(current, existing?.[name]);
    }
    return out;
  });

  const propNames = Object.keys(node.props);
  const includedCount = Object.values(drafts).filter((d) => d.include).length;

  function patchDraft(name: string, patch: Partial<PropDraft>) {
    setDrafts((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  }

  function handleApply() {
    const props: Record<string, PropValue> = {};
    for (const [name, draft] of Object.entries(drafts)) {
      if (!draft.include) continue;
      props[name] =
        draft.mode === "binding"
          ? { type: "binding", expression: draft.expression }
          : draft.staticKind === "boolean"
            ? { type: "static", value: draft.bool }
            : draft.staticKind === "number"
              ? { type: "static", value: Number(draft.text) || 0 }
              : { type: "static", value: draft.text };
    }
    onSave(props);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Override props — ${node.component}`}
      widthClassName="max-w-xl"
    >
      {propNames.length === 0 ? (
        <p className="text-sm text-slate-400">This node has no props to override.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {propNames.map((name) => {
            const draft = drafts[name];
            return (
              <div key={name} className="flex items-center gap-2 py-2.5">
                <input
                  type="checkbox"
                  checked={draft.include}
                  onChange={(e) => patchDraft(name, { include: e.target.checked })}
                  className="h-3.5 w-3.5 shrink-0 accent-slate-900"
                  title="Override this prop in the variant"
                />
                <span
                  className="w-28 shrink-0 truncate font-mono text-xs text-slate-700"
                  title={name}
                >
                  {name}
                </span>
                <Segmented
                  value={draft.mode}
                  onChange={(mode) => patchDraft(name, { mode })}
                  options={[
                    { value: "static", label: "Static" },
                    { value: "binding", label: "Binding" },
                  ]}
                  disabled={!draft.include}
                />
                <div className="flex min-w-0 flex-1 items-center">
                  {draft.mode === "binding" ? (
                    <Input
                      value={draft.expression}
                      onChange={(e) => patchDraft(name, { expression: e.target.value })}
                      placeholder="{{ user.name }}"
                      className="h-8 font-mono text-xs"
                      disabled={!draft.include}
                    />
                  ) : draft.staticKind === "boolean" ? (
                    <Switch
                      checked={draft.bool}
                      onCheckedChange={(bool) => patchDraft(name, { bool })}
                      disabled={!draft.include}
                    />
                  ) : (
                    <Input
                      type={draft.staticKind === "number" ? "number" : "text"}
                      value={draft.text}
                      onChange={(e) => patchDraft(name, { text: e.target.value })}
                      className="h-8 text-xs"
                      disabled={!draft.include}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {includedCount} {includedCount === 1 ? "prop" : "props"} overridden
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} disabled={propNames.length === 0}>
            Apply
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------- Patch tree ------------------------------- */

function PatchNodeRow({
  node,
  depth,
  isRoot,
  inheritedHidden,
  hiddenIds,
  overrides,
  onToggleHide,
  onOpenOverride,
}: {
  node: Node;
  depth: number;
  isRoot: boolean;
  inheritedHidden: boolean;
  hiddenIds: Set<string>;
  overrides: Map<string, Record<string, PropValue>>;
  onToggleHide: (nodeId: string) => void;
  onOpenOverride: (nodeId: string) => void;
}) {
  const isHidden = hiddenIds.has(node.id);
  const dimmed = isHidden || inheritedHidden;
  const overrideCount = Object.keys(overrides.get(node.id) ?? {}).length;

  return (
    <>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100"
        style={{ paddingLeft: depth * 18 + 8 }}
      >
        <span
          className={cx(
            "truncate text-sm font-medium",
            dimmed ? "text-slate-400 line-through" : "text-slate-800",
          )}
        >
          {node.component}
        </span>
        {overrideCount > 0 && (
          <Badge tone="blue" className="shrink-0">
            {overrideCount} overridden
          </Badge>
        )}
        {inheritedHidden && (
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-300">
            hidden by parent
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {!dimmed && Object.keys(node.props).length > 0 && (
            <button
              type="button"
              onClick={() => onOpenOverride(node.id)}
              title="Override props in this variant"
              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <SlidersHorizontal size={13} />
            </button>
          )}
          {!inheritedHidden && (
            <button
              type="button"
              disabled={isRoot}
              onClick={() => onToggleHide(node.id)}
              title={
                isRoot
                  ? "The root node cannot be hidden"
                  : isHidden
                    ? "Show in this variant"
                    : "Hide in this variant"
              }
              className={cx(
                "rounded p-1 hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30",
                isHidden ? "text-slate-600" : "text-slate-400",
              )}
            >
              {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
        </span>
      </div>

      {Object.entries(node.slots ?? {}).map(([slotName, children]) =>
        children.length === 0 ? null : (
          <div key={slotName}>
            <div
              className="select-none px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              style={{ paddingLeft: (depth + 1) * 18 + 8 }}
            >
              {slotName}
            </div>
            {children.map((child) => (
              <PatchNodeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                isRoot={false}
                inheritedHidden={dimmed}
                hiddenIds={hiddenIds}
                overrides={overrides}
                onToggleHide={onToggleHide}
                onOpenOverride={onOpenOverride}
              />
            ))}
          </div>
        ),
      )}
    </>
  );
}

/**
 * Read-only outline of a snapshot tree with per-node patch controls:
 * an eye toggle ({op:"hide"}) and a props-override dialog ({op:"setProps"}).
 */
export function PatchTree({
  tree,
  patches,
  onChange,
}: {
  tree: Node;
  patches: VariantPatch[];
  onChange: (patches: VariantPatch[]) => void;
}) {
  const [overrideNodeId, setOverrideNodeId] = useState<string | null>(null);

  const nodeIndex = useMemo(() => indexNodes(tree), [tree]);
  const hiddenIds = useMemo(
    () => new Set(patches.filter((p) => p.op === "hide").map((p) => p.nodeId)),
    [patches],
  );
  const overrides = useMemo(() => {
    const map = new Map<string, Record<string, PropValue>>();
    for (const patch of patches) {
      if (patch.op === "setProps") map.set(patch.nodeId, patch.props);
    }
    return map;
  }, [patches]);

  function toggleHide(nodeId: string) {
    if (hiddenIds.has(nodeId)) {
      onChange(patches.filter((p) => !(p.op === "hide" && p.nodeId === nodeId)));
    } else {
      onChange([...patches, { op: "hide", nodeId }]);
    }
  }

  function saveOverride(nodeId: string, props: Record<string, PropValue>) {
    const rest = patches.filter((p) => !(p.op === "setProps" && p.nodeId === nodeId));
    onChange(Object.keys(props).length > 0 ? [...rest, { op: "setProps", nodeId, props }] : rest);
    setOverrideNodeId(null);
  }

  const overrideNode = overrideNodeId ? (nodeIndex.get(overrideNodeId) ?? null) : null;

  return (
    <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
      <PatchNodeRow
        node={tree}
        depth={0}
        isRoot
        inheritedHidden={false}
        hiddenIds={hiddenIds}
        overrides={overrides}
        onToggleHide={toggleHide}
        onOpenOverride={setOverrideNodeId}
      />
      {overrideNode && (
        <PropsOverrideDialog
          key={overrideNode.id}
          node={overrideNode}
          existing={overrides.get(overrideNode.id)}
          onClose={() => setOverrideNodeId(null)}
          onSave={(props) => saveOverride(overrideNode.id, props)}
        />
      )}
    </div>
  );
}
