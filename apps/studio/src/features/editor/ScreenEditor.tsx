import type { DragEndEvent, DragMoveEvent, DragStartEvent } from "@dnd-kit/core";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { ChevronDown, Eye, History, Layers, Save, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Dropdown } from "../../components/ui/Dropdown";
import { Field } from "../../components/ui/Input";
import { Segmented } from "../../components/ui/Segmented";
import { Select } from "../../components/ui/Select";
import { cx } from "../../lib/cx";
import { formatDateTime } from "../../lib/format";
import {
  useComponents,
  useCreatePublication,
  useCreateSnapshot,
  useExperiments,
  useScreens,
  useSnapshots,
  useUpdateScreen,
} from "../../lib/hooks";
import type { Channel, Component, Snapshot } from "../../lib/types";
import { CHANNELS } from "../../lib/types";
import { findNodeById, findNodeLocation, useEditorStore } from "../../store/editor";
import { toast } from "../../store/toast";
import { ChannelsDialog } from "../screens/ChannelsDialog";
import { CanvasView } from "./CanvasView";
import { CatalogPanel } from "./CatalogPanel";
import { PropsPanel } from "./PropsPanel";
import { TreeOutline } from "./TreeOutline";
import type {
  CanvasDndState,
  CanvasDragData,
  CanvasDropData,
  DropIndicator,
  DropTarget,
} from "./canvasDnd";
import {
  CanvasDndContext,
  EMPTY_NODE_SET,
  canvasCollisionDetection,
  collectNodeIds,
} from "./canvasDnd";

const VIEW_STORAGE_KEY = "seam-studio.editor.view";

type EditorView = "canvas" | "tree";

function loadView(): EditorView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "tree" ? "tree" : "canvas";
  } catch {
    return "canvas";
  }
}

/** Pointer Y at this point of the drag (activator position + accumulated delta). */
function getPointerY(event: DragMoveEvent): number | null {
  const activator = event.activatorEvent as Partial<PointerEvent> | null;
  if (!activator || typeof activator.clientY !== "number") return null;
  return activator.clientY + event.delta.y;
}

/** Counts the rendered children whose vertical midpoint is above the pointer. */
function computeInsertionIndex(slotId: string, pointerY: number | null): number {
  const container = document.querySelector(`[data-slot-children="${CSS.escape(slotId)}"]`);
  if (!container || pointerY === null) return 0;
  let index = 0;
  for (const el of Array.from(container.querySelectorAll(":scope > [data-canvas-node]"))) {
    const rect = el.getBoundingClientRect();
    if (pointerY > rect.top + rect.height / 2) index += 1;
  }
  return index;
}

export function ScreenEditor() {
  const { projectId = "", screenId = "" } = useParams();

  const screensQuery = useScreens(projectId);
  const screen = screensQuery.data?.find((s) => s.id === screenId);
  const componentsQuery = useComponents(projectId);
  const snapshotsQuery = useSnapshots(projectId, screenId);
  const experimentsQuery = useExperiments(projectId);

  const createSnapshot = useCreateSnapshot(projectId, screenId);
  const createPublication = useCreatePublication(projectId, screenId);
  const updateScreen = useUpdateScreen(projectId);

  const tree = useEditorStore((s) => s.tree);
  const isDirty = useEditorStore((s) => s.isDirty);
  const currentSnapshotVersion = useEditorStore((s) => s.currentSnapshotVersion);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const setTree = useEditorStore((s) => s.setTree);
  const addNode = useEditorStore((s) => s.addNode);
  const loadSnapshot = useEditorStore((s) => s.loadSnapshot);
  const markSaved = useEditorStore((s) => s.markSaved);
  const resetEditor = useEditorStore((s) => s.resetEditor);

  const moveNode = useEditorStore((s) => s.moveNode);

  const [currentSnapshotId, setCurrentSnapshotId] = useState<string | null>(null);
  const [viewingSnapshot, setViewingSnapshot] = useState<Snapshot | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishChannel, setPublishChannel] = useState<Channel>("production");
  const [publishExperimentId, setPublishExperimentId] = useState("");
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const loadedScreenRef = useRef<string | null>(null);

  // Canvas / Tree view toggle (persisted)
  const [view, setView] = useState<EditorView>(loadView);
  function changeView(next: EditorView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable — keep the in-memory value
    }
  }

  // Drag & drop state (catalog rows + canvas boxes → slot regions)
  const [activeDrag, setActiveDrag] = useState<CanvasDragData | null>(null);
  const [indicator, setIndicator] = useState<DropIndicator | null>(null);
  const [forbidden, setForbidden] = useState<ReadonlySet<string>>(EMPTY_NODE_SET);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Load the latest snapshot into the store when the screen changes
  useEffect(() => {
    if (!snapshotsQuery.data || loadedScreenRef.current === screenId) return;
    loadedScreenRef.current = screenId;
    setViewingSnapshot(null);
    const latest = snapshotsQuery.data[0] ?? null;
    loadSnapshot(latest?.tree ?? null, latest?.version ?? null);
    setCurrentSnapshotId(latest?.id ?? null);
  }, [snapshotsQuery.data, screenId, loadSnapshot]);

  // Reset the store when leaving the editor
  useEffect(() => {
    return () => {
      loadedScreenRef.current = null;
      resetEditor();
    };
  }, [screenId, resetEditor]);

  useEffect(() => {
    if (screen) setNameDraft(screen.name);
  }, [screen]);

  const components = componentsQuery.data ?? [];
  const componentsByName = new Map(components.map((c) => [c.name, c] as const));
  const readOnly = viewingSnapshot !== null;
  const activeTree = viewingSnapshot ? viewingSnapshot.tree : tree;

  function handleAddComponent(component: Component) {
    if (readOnly) return;
    if (!tree) {
      addNode(null, "children", component.name);
      return;
    }
    const parentId = selectedNodeId ?? tree.id;
    const parentNode = findNodeById(tree, parentId);
    const parentComponent = parentNode ? componentsByName.get(parentNode.component) : undefined;
    const slotName =
      (parentComponent &&
        Object.entries(parentComponent.props).find(([, def]) => def.type === "slot")?.[0]) ??
      "children";
    addNode(parentId, slotName, component.name);
  }

  /* ------------------------------ Drag & drop ------------------------------ */

  function clearDropState() {
    dropTargetRef.current = null;
    setIndicator(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as CanvasDragData | undefined;
    if (!data) return;
    setActiveDrag(data);
    if (data.kind === "node" && tree) {
      const dragged = findNodeById(tree, data.nodeId);
      setForbidden(dragged ? collectNodeIds(dragged) : new Set([data.nodeId]));
    } else {
      setForbidden(EMPTY_NODE_SET);
    }
  }

  function handleDragMove(event: DragMoveEvent) {
    const data = event.active.data.current as CanvasDragData | undefined;
    const overData = event.over?.data.current as CanvasDropData | undefined;
    if (!data || !event.over || !overData || readOnly) {
      clearDropState();
      return;
    }
    if (overData.kind === "root") {
      // Empty-tree drop zone: only catalog items can become the root.
      dropTargetRef.current =
        data.kind === "catalog" && !tree ? { parentId: null, slot: "children", index: 0 } : null;
      setIndicator(null);
      return;
    }
    if (data.kind === "node" && forbidden.has(overData.parentId)) {
      clearDropState();
      return;
    }
    const slotId = String(event.over.id);
    const index = computeInsertionIndex(slotId, getPointerY(event));
    dropTargetRef.current = { parentId: overData.parentId, slot: overData.slot, index };
    setIndicator((prev) =>
      prev && prev.slotId === slotId && prev.index === index ? prev : { slotId, index },
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as CanvasDragData | undefined;
    const target = dropTargetRef.current;
    setActiveDrag(null);
    setForbidden(EMPTY_NODE_SET);
    clearDropState();
    if (!data || !target || readOnly) return;

    if (data.kind === "catalog") {
      if (target.parentId === null) {
        if (!tree) addNode(null, "children", data.componentName);
      } else {
        addNode(target.parentId, target.slot, data.componentName, target.index);
      }
      return;
    }

    // Moving an existing node
    if (!tree || tree.id === data.nodeId || target.parentId === null) return;
    if (forbidden.has(target.parentId)) return;
    const location = findNodeLocation(tree, data.nodeId);
    if (!location) return;
    let index = target.index;
    if (location.parent.id === target.parentId && location.slot === target.slot) {
      // Same-slot reorder: the visual index counts the dragged node itself,
      // but moveNode removes it before re-inserting.
      if (location.index < index) index -= 1;
      if (index === location.index) return; // dropped back in place — no-op
    }
    moveNode(data.nodeId, target.parentId, target.slot, index);
  }

  function handleDragCancel() {
    setActiveDrag(null);
    setForbidden(EMPTY_NODE_SET);
    clearDropState();
  }

  const canvasDndState = useMemo<CanvasDndState>(
    () => ({
      indicator,
      forbidden,
      activeNodeId: activeDrag?.kind === "node" ? activeDrag.nodeId : null,
      isDragging: activeDrag !== null,
    }),
    [indicator, forbidden, activeDrag],
  );

  const dragOverlayLabel = activeDrag
    ? activeDrag.kind === "catalog"
      ? activeDrag.componentName
      : ((tree && findNodeById(tree, activeDrag.nodeId)?.component) ?? "Node")
    : null;

  async function saveDraft(): Promise<Snapshot | null> {
    if (!tree) {
      toast.error("The tree is empty — add a component before saving.");
      return null;
    }
    const snapshot = await createSnapshot.mutateAsync({ tree });
    setCurrentSnapshotId(snapshot.id);
    markSaved(snapshot.version);
    return snapshot;
  }

  async function handleSaveDraft() {
    try {
      const snapshot = await saveDraft();
      if (snapshot) toast.success(`Saved draft v${snapshot.version}`);
    } catch {
      // handled globally
    }
  }

  function openPublishDialog() {
    setPublishChannel("production");
    setPublishExperimentId("");
    setPublishOpen(true);
  }

  async function handlePublish() {
    try {
      let snapshotId = currentSnapshotId;
      let version = currentSnapshotVersion;
      if (isDirty || !snapshotId) {
        const snapshot = await saveDraft();
        if (!snapshot) return;
        snapshotId = snapshot.id;
        version = snapshot.version;
      }
      await createPublication.mutateAsync({
        snapshotId,
        channel: publishChannel,
        ...(publishExperimentId ? { experimentId: publishExperimentId } : {}),
      });
      setPublishOpen(false);
      toast.success(`Published v${version} to ${publishChannel}`);
    } catch {
      // handled globally (incl. EXPERIMENT_CONFLICT problems)
    }
  }

  function commitName() {
    const trimmed = nameDraft.trim();
    if (!screen || !trimmed || trimmed === screen.name) {
      setNameDraft(screen?.name ?? "");
      return;
    }
    updateScreen.mutate({ screenId, body: { name: trimmed } });
  }

  function handleSelectVersion(snapshot: Snapshot) {
    const latest = snapshotsQuery.data?.[0];
    if (snapshot.id === currentSnapshotId || (!currentSnapshotId && snapshot.id === latest?.id)) {
      setViewingSnapshot(null);
    } else {
      setViewingSnapshot(snapshot);
    }
  }

  function handleRestore() {
    if (!viewingSnapshot) return;
    setTree(viewingSnapshot.tree);
    setViewingSnapshot(null);
    toast.info(`Restored v${viewingSnapshot.version} as a draft — save to keep it.`);
  }

  const snapshots = snapshotsQuery.data ?? [];
  const busy = createSnapshot.isPending || createPublication.isPending;

  // Active experiments that target this screen (or have no target) can be
  // attached to the publication.
  const eligibleExperiments = (experimentsQuery.data ?? []).filter(
    (experiment) =>
      experiment.status === "active" &&
      (experiment.screenId == null || experiment.screenId === screenId),
  );

  const latestVersion = snapshots[0]?.version ?? 0;
  const publishVersion =
    isDirty || !currentSnapshotId ? latestVersion + 1 : (currentSnapshotVersion ?? latestVersion);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setNameDraft(screen?.name ?? "");
          }}
          className="h-8 min-w-0 max-w-72 flex-shrink rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
          placeholder="Screen name"
        />
        {screen && <span className="font-mono text-xs text-slate-400">/{screen.path}</span>}
        <div className="flex-1" />

        <Segmented
          value={view}
          onChange={changeView}
          options={[
            { value: "canvas", label: "Canvas" },
            { value: "tree", label: "Tree" },
          ]}
        />

        <Dropdown
          align="end"
          trigger={
            <Button variant="secondary" size="sm">
              <History size={13} />
              {viewingSnapshot
                ? `v${viewingSnapshot.version} (viewing)`
                : currentSnapshotVersion
                  ? `v${currentSnapshotVersion}${isDirty ? " •" : ""}`
                  : "No versions"}
              <ChevronDown size={13} />
            </Button>
          }
          items={
            snapshots.length === 0
              ? [{ label: "No snapshots yet", onSelect: () => {}, disabled: true }]
              : snapshots.map((snapshot) => ({
                  label: `v${snapshot.version} — ${formatDateTime(snapshot.createdAt)}`,
                  onSelect: () => handleSelectVersion(snapshot),
                }))
          }
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={handleSaveDraft}
          disabled={!tree || !isDirty || readOnly || busy}
        >
          <Save size={13} />
          {createSnapshot.isPending ? "Saving…" : "Save Draft"}
        </Button>
        <Button
          size="sm"
          onClick={openPublishDialog}
          disabled={(!tree && !currentSnapshotId) || readOnly || busy}
        >
          <Upload size={13} />
          Publish
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setChannelsOpen(true)}
          title="Manage release channels"
        >
          <Layers size={13} />
          Channels
        </Button>
        <Link to={`/${projectId}/screens/${screenId}/preview`}>
          <Button variant="ghost" size="sm">
            <Eye size={13} />
            Preview
          </Button>
        </Link>
      </header>

      {/* Read-only banner */}
      {viewingSnapshot && (
        <div className="flex shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>
            Viewing <span className="font-semibold">v{viewingSnapshot.version}</span> (read-only)
          </span>
          <Button variant="secondary" size="sm" onClick={handleRestore}>
            Restore this version
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setViewingSnapshot(null)}>
            Back to latest
          </Button>
        </div>
      )}

      {/* Three panels */}
      <DndContext
        sensors={sensors}
        collisionDetection={canvasCollisionDetection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <CanvasDndContext.Provider value={canvasDndState}>
          <div className={cx("flex min-h-0 flex-1", activeDrag && "select-none")}>
            <CatalogPanel components={components} onAdd={handleAddComponent} disabled={readOnly} />
            <div className="min-w-0 flex-1 overflow-hidden bg-slate-50">
              {snapshotsQuery.isLoading ? (
                <p className="p-8 text-sm text-slate-500">Loading…</p>
              ) : view === "canvas" ? (
                <CanvasView
                  tree={activeTree}
                  readOnly={readOnly}
                  componentsByName={componentsByName}
                />
              ) : (
                <div className="h-full overflow-y-auto">
                  <TreeOutline tree={activeTree} readOnly={readOnly} />
                </div>
              )}
            </div>
            <PropsPanel projectId={projectId} readOnly={readOnly} />
          </div>
          <DragOverlay dropAnimation={null}>
            {dragOverlayLabel ? (
              <div className="pointer-events-none rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-lg">
                {dragOverlayLabel}
              </div>
            ) : null}
          </DragOverlay>
        </CanvasDndContext.Provider>
      </DndContext>

      {/* Publish dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen} title={`Publish v${publishVersion}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {isDirty || !currentSnapshotId
              ? "Your draft will be saved as a new snapshot and published."
              : `Snapshot v${publishVersion} will become the active publication.`}
          </p>
          <Field label="Channel" hint="The release channel this publication targets.">
            <Select
              value={publishChannel}
              onChange={(e) => setPublishChannel(e.target.value as Channel)}
            >
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Experiment"
            hint={
              eligibleExperiments.length === 0
                ? "No active experiments target this screen."
                : "Optionally attach an active experiment to this publication."
            }
          >
            <Select
              value={publishExperimentId}
              onChange={(e) => setPublishExperimentId(e.target.value)}
              disabled={eligibleExperiments.length === 0}
            >
              <option value="">None</option>
              {eligibleExperiments.map((experiment) => (
                <option key={experiment.id} value={experiment.id}>
                  {experiment.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPublishOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={busy}>
              <Upload size={13} />
              {busy ? "Publishing…" : `Publish to ${publishChannel}`}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Channels manager */}
      <ChannelsDialog
        projectId={projectId}
        screenId={screenId}
        open={channelsOpen}
        onOpenChange={setChannelsOpen}
      />
    </div>
  );
}
