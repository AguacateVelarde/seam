import { useParams } from "react-router-dom";
import { useActions } from "../../lib/hooks";
import { ActionForm } from "./ActionForm";

export function ActionEditor() {
  const { projectId = "", actionId = "" } = useParams();
  const { data: actions, isLoading } = useActions(projectId);
  const action = actions?.find((a) => a.id === actionId);

  if (isLoading) {
    return <p className="px-8 py-8 text-sm text-slate-500">Loading action…</p>;
  }
  if (!action) {
    return <p className="px-8 py-8 text-sm text-slate-500">Action not found.</p>;
  }
  return <ActionForm key={action.id} projectId={projectId} existing={action} />;
}
