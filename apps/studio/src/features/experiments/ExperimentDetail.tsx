import { ArrowLeft, Lock, Pause, Play, Square } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { cx } from "../../lib/cx";
import { shortId } from "../../lib/format";
import { useExperiment, useUpdateExperiment } from "../../lib/hooks";
import type { ExperimentStatus } from "../../lib/types";
import { toast } from "../../store/toast";
import { experimentStatusTone } from "./ExperimentList";

const VARIANT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
];

const transitions: Record<
  ExperimentStatus,
  Array<{
    to: ExperimentStatus;
    label: string;
    icon: typeof Play;
    variant: "primary" | "secondary" | "danger";
  }>
> = {
  draft: [{ to: "active", label: "Activate", icon: Play, variant: "primary" }],
  active: [
    { to: "paused", label: "Pause", icon: Pause, variant: "secondary" },
    { to: "concluded", label: "Conclude", icon: Square, variant: "danger" },
  ],
  paused: [
    { to: "active", label: "Activate", icon: Play, variant: "primary" },
    { to: "concluded", label: "Conclude", icon: Square, variant: "danger" },
  ],
  concluded: [],
};

export function ExperimentDetail() {
  const { projectId = "", experimentId = "" } = useParams();
  const { data: experiment, isLoading } = useExperiment(projectId, experimentId);
  const updateExperiment = useUpdateExperiment(projectId, experimentId);

  async function transitionTo(status: ExperimentStatus) {
    try {
      await updateExperiment.mutateAsync({ status });
      toast.success(`Experiment ${status === "active" ? "activated" : status}`);
    } catch {
      // handled globally (e.g. EXPERIMENT_CONFLICT)
    }
  }

  if (isLoading) {
    return <p className="px-8 py-8 text-sm text-slate-500">Loading experiment…</p>;
  }
  if (!experiment) {
    return <p className="px-8 py-8 text-sm text-slate-500">Experiment not found.</p>;
  }

  const strategySummary =
    experiment.strategy.type === "user_id"
      ? `User ID allocation via header "${experiment.strategy.header}" (always sticky)`
      : `Percentage allocation — ${experiment.strategy.sticky ? `sticky for ${experiment.strategy.ttlDays} days` : "not sticky"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <Link
        to={`/${projectId}/experiments`}
        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
      >
        <ArrowLeft size={12} />
        Experiments
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900">{experiment.name}</h1>
        <Badge tone={experimentStatusTone[experiment.status]}>{experiment.status}</Badge>
        <div className="flex-1" />
        {transitions[experiment.status].map(({ to, label, icon: Icon, variant }) => (
          <Button
            key={to}
            variant={variant}
            size="sm"
            onClick={() => transitionTo(to)}
            disabled={updateExperiment.isPending}
          >
            <Icon size={13} />
            {label}
          </Button>
        ))}
      </div>

      {/* Strategy */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Strategy</h2>
        <p className="text-sm text-slate-600">{strategySummary}</p>
        {experiment.assignmentCount !== null && (
          <p className="mt-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{experiment.assignmentCount}</span>{" "}
            assignments recorded
          </p>
        )}
      </section>

      {/* Variants */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Variants</h2>

        {experiment.status === "active" && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Lock size={13} />
            Variants are locked — deactivate experiment to modify.
          </div>
        )}

        {/* Weight bar */}
        <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          {experiment.variants.map((variant, index) => (
            <div
              key={variant.id}
              className={cx("h-full", VARIANT_COLORS[index % VARIANT_COLORS.length])}
              style={{ width: `${variant.weight * 100}%` }}
              title={`${variant.name}: ${Math.round(variant.weight * 1000) / 10}%`}
            />
          ))}
        </div>

        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 font-medium">Variant</th>
              <th className="py-2 font-medium">Weight</th>
              <th className="py-2 font-medium">Snapshot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {experiment.variants.map((variant, index) => (
              <tr key={variant.id}>
                <td className="py-2.5">
                  <span className="flex items-center gap-2">
                    <span
                      className={cx(
                        "h-2.5 w-2.5 rounded-full",
                        VARIANT_COLORS[index % VARIANT_COLORS.length],
                      )}
                    />
                    <span className="font-medium text-slate-800">{variant.name}</span>
                  </span>
                </td>
                <td className="py-2.5 text-slate-600">{Math.round(variant.weight * 1000) / 10}%</td>
                <td className="py-2.5 font-mono text-xs text-slate-500" title={variant.snapshotId}>
                  {shortId(variant.snapshotId, 14)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Affected screens */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Affected screens</h2>
        {experiment.affectedScreens.length === 0 ? (
          <p className="text-sm text-slate-400">
            No screens are currently publishing this experiment.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {experiment.affectedScreens.map((screen) => (
              <li key={screen.id}>
                <Link
                  to={`/${projectId}/screens/${screen.id}`}
                  className="flex items-center justify-between py-2.5 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{screen.name}</span>
                  <span className="font-mono text-xs text-slate-400">/{screen.path}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
