import { MoreVertical, Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatDate } from "../../lib/format";
import { useActions, useDeleteAction } from "../../lib/hooks";
import { toast } from "../../store/toast";

export function ActionList() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data: actions, isLoading } = useActions(projectId);
  const deleteAction = useDeleteAction(projectId);

  async function handleDelete(actionId: string, name: string) {
    try {
      await deleteAction.mutateAsync(actionId);
      toast.success(`Deleted ${name}`);
    } catch {
      // handled globally
    }
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Actions</h1>
        <Link to={`/${projectId}/actions/new`}>
          <Button>
            <Plus size={15} />
            New action
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading actions…</p>
      ) : !actions || actions.length === 0 ? (
        <EmptyState
          title="No actions yet"
          description="Actions are client-side capabilities (navigation.push, sheet.open, …) that components can trigger."
          action={
            <Link to={`/${projectId}/actions/new`}>
              <Button>
                <Plus size={15} />
                New action
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
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Params</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {actions.map((action) => (
                <tr
                  key={action.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => navigate(`/${projectId}/actions/${action.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900">
                    {action.name}
                  </td>
                  <td className="max-w-72 truncate px-4 py-3 text-slate-500">
                    {action.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="blue">{Object.keys(action.params ?? {}).length} params</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(action.updatedAt)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      trigger={
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        >
                          <MoreVertical size={15} />
                        </button>
                      }
                      items={[
                        {
                          label: "Edit",
                          onSelect: () => navigate(`/${projectId}/actions/${action.id}`),
                        },
                        {
                          label: "Delete",
                          danger: true,
                          onSelect: () => handleDelete(action.id, action.name),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
