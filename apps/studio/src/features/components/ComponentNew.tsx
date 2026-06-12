import { useParams } from "react-router-dom";
import { ComponentForm } from "./ComponentForm";

export function ComponentNew() {
  const { projectId = "" } = useParams();
  return <ComponentForm projectId={projectId} />;
}
