import { useQueryClient } from "@tanstack/react-query";
import { Eye, Layers, Pencil, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ApiError, api } from "../../lib/api";
import { cx } from "../../lib/cx";
import { formatDate, formatDateTime } from "../../lib/format";
import { keys, useScreens } from "../../lib/hooks";
import type { Channel, ScreenListItem, ScreenStatus, Snapshot } from "../../lib/types";
import { CHANNELS } from "../../lib/types";
import { toast } from "../../store/toast";
import { ChannelsDialog } from "./ChannelsDialog";

const statusConfig: Record<ScreenStatus, { tone: BadgeTone; label: string }> = {
  published: { tone: "green", label: "Published" },
  draft: { tone: "yellow", label: "Draft" },
  no_publication: { tone: "gray", label: "No publication" },
};

const channelChipConfig: Record<Channel, { short: string; active: string }> = {
  development: { short: "dev", active: "bg-blue-100 text-blue-700" },
  staging: { short: "stg", active: "bg-amber-100 text-amber-700" },
  production: { short: "prod", active: "bg-green-100 text-green-700" },
};

function ChannelChips({ screen }: { screen: ScreenListItem }) {
  return (
    <div className="flex items-center gap-1">
      {CHANNELS.map((channel) => {
        const config = channelChipConfig[channel];
        const state = screen.channels[channel] ?? null;
        const title = state
          ? `${channel}: ${state.version ? `v${state.version}` : state.snapshotId}${
              state.experiment ? ` · experiment ${state.experiment}` : ""
            } · published ${formatDateTime(state.publishedAt)}`
          : `${channel}: not published`;
        return (
          <span
            key={channel}
            title={title}
            className={cx(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
              state ? config.active : "border border-slate-200 text-slate-400",
            )}
          >
            {config.short}
            {state?.version != null && <span className="font-semibold">v{state.version}</span>}
          </span>
        );
      })}
    </div>
  );
}

export function ScreenList() {
  const { projectId = "" } = useParams();
  const { data: screens, isLoading } = useScreens(projectId);
  const queryClient = useQueryClient();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [channelsScreenId, setChannelsScreenId] = useState<string | null>(null);

  async function quickPublish(screen: ScreenListItem) {
    setPublishingId(screen.id);
    try {
      const snapshots = await api<Snapshot[]>(
        `/v1/projects/${projectId}/screens/${screen.id}/snapshots`,
      );
      if (snapshots.length === 0) {
        toast.error("No snapshots to publish. Open the editor and save a draft first.");
        return;
      }
      const latest = snapshots[0];
      await api(`/v1/projects/${projectId}/screens/${screen.id}/publications`, {
        method: "POST",
        body: { snapshotId: latest.id },
      });
      toast.success(`Published ${screen.name} v${latest.version} to production`);
      queryClient.invalidateQueries({ queryKey: keys.screens(projectId) });
    } catch (error) {
      if (error instanceof ApiError) toast.error(`${error.code}: ${error.message}`);
      else toast.error("Publish failed");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Screens</h1>
        <Link to={`/${projectId}/screens/new`}>
          <Button>
            <Plus size={15} />
            New screen
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading screens…</p>
      ) : !screens || screens.length === 0 ? (
        <EmptyState
          title="No screens yet. Create your first screen to start defining UI contracts."
          action={
            <Link to={`/${projectId}/screens/new`}>
              <Button>
                <Plus size={15} />
                New screen
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Path</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Channels</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Active experiment</th>
                <th className="px-4 py-3 font-medium">Last published</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {screens.map((screen) => {
                const status = statusConfig[screen.status];
                return (
                  <tr key={screen.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link to={`/${projectId}/screens/${screen.id}`} className="hover:underline">
                        {screen.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{screen.path}</td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ChannelChips screen={screen} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {screen.activeVersion ? `v${screen.activeVersion}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{screen.activeExperiment ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(screen.lastPublishedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/${projectId}/screens/${screen.id}`} title="Edit">
                          <Button variant="ghost" size="sm">
                            <Pencil size={13} />
                            Edit
                          </Button>
                        </Link>
                        <Link to={`/${projectId}/screens/${screen.id}/preview`} title="Preview">
                          <Button variant="ghost" size="sm">
                            <Eye size={13} />
                            Preview
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setChannelsScreenId(screen.id)}
                          title="Manage release channels"
                        >
                          <Layers size={13} />
                          Channels
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => quickPublish(screen)}
                          disabled={publishingId === screen.id}
                          title="Publish latest snapshot to production"
                        >
                          <Upload size={13} />
                          {publishingId === screen.id ? "Publishing…" : "Publish"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ChannelsDialog
        projectId={projectId}
        screenId={channelsScreenId ?? ""}
        open={channelsScreenId !== null}
        onOpenChange={(open) => {
          if (!open) setChannelsScreenId(null);
        }}
      />
    </div>
  );
}
