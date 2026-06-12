import { ArrowRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { cx } from "../../lib/cx";
import { formatDateTime, shortId } from "../../lib/format";
import { useDeletePublication, usePromotePublication, useScreen } from "../../lib/hooks";
import type { Channel, ChannelState } from "../../lib/types";
import { CHANNELS, nextChannel } from "../../lib/types";
import { toast } from "../../store/toast";

const channelMeta: Record<Channel, { label: string; dot: string }> = {
  development: { label: "Development", dot: "bg-blue-500" },
  staging: { label: "Staging", dot: "bg-amber-500" },
  production: { label: "Production", dot: "bg-green-500" },
};

export function ChannelsDialog({
  projectId,
  screenId,
  open,
  onOpenChange,
}: {
  projectId: string;
  screenId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const screenQuery = useScreen(projectId, screenId, open);
  const promote = usePromotePublication(projectId, screenId);
  const rollback = useDeletePublication(projectId, screenId);
  const [confirmChannel, setConfirmChannel] = useState<Channel | null>(null);

  const screen = screenQuery.data;
  const busy = promote.isPending || rollback.isPending;

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmChannel(null);
    onOpenChange(next);
  }

  async function handlePromote(from: Channel) {
    const to = nextChannel(from);
    if (!to) return;
    try {
      await promote.mutateAsync({ from, to });
      toast.success(`Promoted ${from} → ${to}`);
    } catch {
      // handled globally (incl. EXPERIMENT_CONFLICT meta.problems)
    }
  }

  async function handleRollback(channel: Channel, state: ChannelState) {
    try {
      await rollback.mutateAsync(state.publicationId);
      toast.success(`Rolled back ${channel}`);
    } catch {
      // handled globally
    } finally {
      setConfirmChannel(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={screen ? `Channels — ${screen.name}` : "Channels"}
      widthClassName="max-w-xl"
    >
      {screenQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading channels…</p>
      ) : screenQuery.isError || !screen ? (
        <p className="text-sm text-red-600">Could not load channel state for this screen.</p>
      ) : (
        <div className="space-y-2">
          {CHANNELS.map((channel) => {
            const meta = channelMeta[channel];
            const state = screen.channels[channel] ?? null;
            const promoteTo = nextChannel(channel);
            return (
              <div key={channel} className="rounded-md border border-slate-200 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span
                    className={cx(
                      "h-2 w-2 shrink-0 rounded-full",
                      state ? meta.dot : "bg-slate-300",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{meta.label}</p>
                    {state ? (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {state.version ? `v${state.version}` : shortId(state.snapshotId)}
                        </span>
                        {state.experiment && <Badge tone="purple">{state.experiment}</Badge>}
                        <span>{formatDateTime(state.publishedAt)}</span>
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-400">Not published</p>
                    )}
                  </div>
                  {state && promoteTo && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePromote(channel)}
                      disabled={busy}
                    >
                      <ArrowRight size={13} />
                      Promote → {promoteTo}
                    </Button>
                  )}
                  {state && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmChannel(channel)}
                      disabled={busy}
                    >
                      <RotateCcw size={13} />
                      Roll back
                    </Button>
                  )}
                </div>
                {confirmChannel === channel && state && (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2">
                    <p className="flex-1 text-xs text-red-700">
                      Revert {channel} to its previous publication? If none exists the channel
                      becomes unpublished.
                    </p>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRollback(channel, state)}
                      disabled={busy}
                    >
                      {rollback.isPending ? "Rolling back…" : "Roll back"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmChannel(null)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
