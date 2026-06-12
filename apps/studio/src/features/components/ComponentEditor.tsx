import { useParams } from "react-router-dom";
import { useComponents } from "../../lib/hooks";
import { ComponentForm } from "./ComponentForm";

export function ComponentEditor() {
  const { projectId = "", componentId = "" } = useParams();
  const { data: components, isLoading } = useComponents(projectId);
  const component = components?.find((c) => c.id === componentId);

  if (isLoading) {
    return <p className="px-8 py-8 text-sm text-slate-500">Loading component…</p>;
  }
  if (!component) {
    return <p className="px-8 py-8 text-sm text-slate-500">Component not found.</p>;
  }
  return <ComponentForm key={component.id} projectId={projectId} existing={component} />;
}
