import { MoreVertical, Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatDate } from "../../lib/format";
import { useComponents, useDeleteComponent } from "../../lib/hooks";
import { toast } from "../../store/toast";

export function ComponentList() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data: components, isLoading } = useComponents(projectId);
  const deleteComponent = useDeleteComponent(projectId);

  async function handleDelete(componentId: string, name: string) {
    try {
      await deleteComponent.mutateAsync(componentId);
      toast.success(`Deleted ${name}`);
    } catch {
      // handled globally (e.g. COMPONENT_IN_USE)
    }
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Components</h1>
        <Link to={`/${projectId}/components/new`}>
          <Button>
            <Plus size={15} />
            New component
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading components…</p>
      ) : !components || components.length === 0 ? (
        <EmptyState
          title="No components yet"
          description="Components are the contract between Studio and your client renderers. Define one to start building screens."
          action={
            <Link to={`/${projectId}/components/new`}>
              <Button>
                <Plus size={15} />
                New component
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
                <th className="px-4 py-3 font-medium">Props</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {components.map((component) => (
                <tr
                  key={component.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => navigate(`/${projectId}/components/${component.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900">
                    {component.name}
                  </td>
                  <td className="max-w-72 truncate px-4 py-3 text-slate-500">
                    {component.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="blue">{Object.keys(component.props).length} props</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(component.updatedAt)}</td>
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
                          onSelect: () => navigate(`/${projectId}/components/${component.id}`),
                        },
                        {
                          label: "Delete",
                          danger: true,
                          onSelect: () => handleDelete(component.id, component.name),
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
