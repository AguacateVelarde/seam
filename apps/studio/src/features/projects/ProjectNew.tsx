import { ArrowLeft } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Field, Input, Textarea } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useCreateProject, useMe } from "../../lib/hooks";

export function ProjectNew() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const { data: me } = useMe();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");

  const workspaces = me?.workspaces ?? [];

  // Preselect when there's exactly one workspace (or default to the first).
  useEffect(() => {
    if (!workspaceId && workspaces.length > 0) {
      setWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, workspaceId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !workspaceId) return;
    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        workspaceId,
      });
      navigate(`/${project.id}/screens`);
    } catch {
      // error toast handled globally
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-lg px-6 py-12">
        <Link
          to="/projects"
          className="mb-6 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft size={12} />
          Back to projects
        </Link>
        <h1 className="mb-6 text-lg font-semibold text-slate-900">New project</h1>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Banking App"
              autoFocus
            />
          </Field>
          <Field label="Workspace">
            <Select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              {workspaces.length === 0 && <option value="">Loading workspaces…</option>}
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project for?"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Link to="/projects">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button
              type="submit"
              disabled={!name.trim() || !workspaceId || createProject.isPending}
            >
              {createProject.isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
