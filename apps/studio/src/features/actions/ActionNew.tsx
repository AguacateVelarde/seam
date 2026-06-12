import { useParams } from "react-router-dom";
import { ActionForm } from "./ActionForm";

export function ActionNew() {
  const { projectId = "" } = useParams();
  return <ActionForm projectId={projectId} />;
}
