import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Segmented } from "../../components/ui/Segmented";
import { cx } from "../../lib/cx";
import type { Component, Node } from "../../lib/types";
import { WireBox } from "./WireBox";
import type { CanvasDropData } from "./canvasDnd";
import { ROOT_DROPPABLE_ID, useCanvasDnd } from "./canvasDnd";

const ZOOM_STORAGE_KEY = "seam-studio.editor.canvas-zoom";

type ZoomLevel = "50" | "75" | "100";

function loadZoom(): ZoomLevel {
  try {
    const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
    return stored === "50" || stored === "75" ? stored : "100";
  } catch {
    return "100";
  }
}

function DeviceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[720px] w-[390px] flex-col rounded-2xl border border-slate-300 bg-white shadow-lg shadow-slate-200/80">
      {/* Status bar hint */}
      <div className="relative flex h-8 shrink-0 items-center justify-between px-5">
        <span className="select-none text-[10px] font-semibold text-slate-500">9:41</span>
        <span className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-slate-200" />
        <span className="h-1.5 w-4 rounded-sm bg-slate-300" />
      </div>
      <div className="flex flex-1 flex-col p-3">{children}</div>
    </div>
  );
}

function EmptyTreeDropZone({ readOnly }: { readOnly: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: ROOT_DROPPABLE_ID,
    data: { kind: "root" } satisfies CanvasDropData,
    disabled: readOnly,
  });

  return (
    <div
      ref={setNodeRef}
      className={cx(
        "flex flex-1 items-center justify-center rounded-xl border-2 border-dashed",
        isOver ? "border-blue-400 bg-blue-50/50" : "border-slate-200",
      )}
    >
      <p className="max-w-[220px] select-none text-center text-xs text-slate-400">
        Drag a component here to start
      </p>
    </div>
  );
}

export function CanvasView({
  tree,
  readOnly,
  componentsByName,
}: {
  tree: Node | null;
  readOnly: boolean;
  componentsByName: Map<string, Component>;
}) {
  const [zoom, setZoom] = useState<ZoomLevel>(loadZoom);
  const { isDragging } = useCanvasDnd();

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, zoom);
    } catch {
      // localStorage unavailable — keep the in-memory value
    }
  }, [zoom]);

  const scale = Number(zoom) / 100;

  return (
    <div
      className={cx("h-full overflow-auto", isDragging && "select-none")}
      style={{
        backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="flex min-h-full flex-col items-center px-8 py-6">
        {/* Zoom control */}
        <div className="mb-4 flex items-center gap-2">
          <span className="select-none text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Zoom
          </span>
          <Segmented
            value={zoom}
            onChange={setZoom}
            options={[
              { value: "50", label: "50%" },
              { value: "75", label: "75%" },
              { value: "100", label: "100%" },
            ]}
          />
        </div>

        {/* Device frame (scaled) */}
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
          <DeviceFrame>
            {tree ? (
              <WireBox node={tree} isRoot readOnly={readOnly} componentsByName={componentsByName} />
            ) : (
              <EmptyTreeDropZone readOnly={readOnly} />
            )}
          </DeviceFrame>
        </div>
      </div>
    </div>
  );
}
