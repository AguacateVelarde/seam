import { Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatDate } from "../../lib/format";
import { useExperiments } from "../../lib/hooks";
import type { ExperimentStatus } from "../../lib/types";

export const experimentStatusTone: Record<ExperimentStatus, BadgeTone> = {
  draft: "gray",
  active: "green",
  paused: "yellow",
  concluded: "blue",
};

export function ExperimentList() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data: experiments, isLoading } = useExperiments(projectId);

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Experiments</h1>
        <Link to={`/${projectId}/experiments/new`}>
          <Button>
            <Plus size={15} />
            New experiment
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading experiments…</p>
      ) : !experiments || experiments.length === 0 ? (
        <EmptyState
          title="No experiments yet"
          description="Run A/B tests by splitting traffic between snapshots of your screens."
          action={
            <Link to={`/${projectId}/experiments/new`}>
              <Button>
                <Plus size={15} />
                New experiment
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
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Strategy</th>
                <th className="px-4 py-3 font-medium">Variants</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {experiments.map((experiment) => (
                <tr
                  key={experiment.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => navigate(`/${projectId}/experiments/${experiment.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{experiment.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={experimentStatusTone[experiment.status]}>
                      {experiment.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {experiment.strategy.type}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{experiment.variants.length}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(experiment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
