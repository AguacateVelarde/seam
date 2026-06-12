import { ChevronDown, Eye, History, Save, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { formatDateTime } from "../../lib/format";
import {
  useComponents,
  useCreatePublication,
  useCreateSnapshot,
  useScreens,
  useSnapshots,
  useUpdateScreen,
} from "../../lib/hooks";
import type { Component, Snapshot } from "../../lib/types";
import { findNodeById, useEditorStore } from "../../store/editor";
import { toast } from "../../store/toast";
import { CatalogPanel } from "./CatalogPanel";
import { PropsPanel } from "./PropsPanel";
import { TreeOutline } from "./TreeOutline";

export function ScreenEditor() {
  const { projectId = "", screenId = "" } = useParams();

  const screensQuery = useScreens(projectId);
  const screen = screensQuery.data?.find((s) => s.id === screenId);
  const componentsQuery = useComponents(projectId);
  const snapshotsQuery = useSnapshots(projectId, screenId);

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

  const [currentSnapshotId, setCurrentSnapshotId] = useState<string | null>(null);
  const [viewingSnapshot, setViewingSnapshot] = useState<Snapshot | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const loadedScreenRef = useRef<string | null>(null);

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
      await createPublication.mutateAsync({ snapshotId });
      toast.success(`Published v${version}`);
    } catch {
      // handled globally
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
          onClick={handlePublish}
          disabled={(!tree && !currentSnapshotId) || readOnly || busy}
        >
          <Upload size={13} />
          {createPublication.isPending ? "Publishing…" : "Publish"}
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
      <div className="flex min-h-0 flex-1">
        <CatalogPanel components={components} onAdd={handleAddComponent} disabled={readOnly} />
        <div className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
          {snapshotsQuery.isLoading ? (
            <p className="p-8 text-sm text-slate-500">Loading…</p>
          ) : (
            <TreeOutline tree={activeTree} readOnly={readOnly} />
          )}
        </div>
        <PropsPanel projectId={projectId} readOnly={readOnly} />
      </div>
    </div>
  );
}
