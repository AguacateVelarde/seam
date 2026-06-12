import { Layers, Plus, Settings } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { HeaderUserMenu } from "../../components/UserMenu";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Field, Input } from "../../components/ui/Input";
import { formatDate } from "../../lib/format";
import { useCreateWorkspace, useMe, useProjects } from "../../lib/hooks";
import type { Project } from "../../lib/types";
import { toast } from "../../store/toast";

export function ProjectList() {
  const { data: projects, isLoading, isError } = useProjects();
  const { data: me } = useMe();
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);

  const workspaces = me?.workspaces ?? [];

  // Group projects by workspace; anything without a workspace goes last.
  const byWorkspace = new Map<string, Project[]>();
  const unassigned: Project[] = [];
  for (const project of projects ?? []) {
    if (project.workspaceId) {
      const list = byWorkspace.get(project.workspaceId) ?? [];
      list.push(project);
      byWorkspace.set(project.workspaceId, list);
    } else {
      unassigned.push(project);
    }
  }
  // Workspaces the user belongs to but that aren't in /auth/me (shouldn't
  // happen, but don't drop projects on the floor).
  const knownIds = new Set(workspaces.map((w) => w.id));
  const orphanWorkspaceIds = [...byWorkspace.keys()].filter((id) => !knownIds.has(id));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-6">
          <Layers size={18} className="text-slate-700" />
          <span className="text-sm font-semibold text-slate-900">Seam Studio</span>
          <div className="ml-auto">
            <HeaderUserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Projects</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setNewWorkspaceOpen(true)}>
              <Plus size={15} />
              New workspace
            </Button>
            <Link to="/projects/new">
              <Button>
                <Plus size={15} />
                New project
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading projects…</p>
        ) : isError ? (
          <p className="text-sm text-red-600">
            Could not load projects. Check that the Seam server is running.
          </p>
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create a project to start defining components, screens, and experiments."
            action={
              <Link to="/projects/new">
                <Button>
                  <Plus size={15} />
                  New project
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-10">
            {workspaces.map((workspace) => (
              <WorkspaceSection
                key={workspace.id}
                name={workspace.name}
                settingsTo={`/workspaces/${workspace.id}/settings`}
                projects={byWorkspace.get(workspace.id) ?? []}
              />
            ))}
            {orphanWorkspaceIds.map((id) => (
              <WorkspaceSection
                key={id}
                name="Other workspace"
                settingsTo={`/workspaces/${id}/settings`}
                projects={byWorkspace.get(id) ?? []}
              />
            ))}
            {unassigned.length > 0 && <WorkspaceSection name="Unassigned" projects={unassigned} />}
          </div>
        )}
      </main>

      <NewWorkspaceDialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen} />
    </div>
  );
}

function WorkspaceSection({
  name,
  settingsTo,
  projects,
}: {
  name: string;
  settingsTo?: string;
  projects: Project[];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{name}</h2>
        {settingsTo && (
          <Link
            to={settingsTo}
            title={`${name} settings`}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Settings size={14} />
          </Link>
        )}
      </div>
      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          No projects in this workspace yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/${project.id}/screens`}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="truncate text-sm font-semibold text-slate-900">{project.name}</p>
              <p className="mt-1 line-clamp-2 min-h-9 text-sm text-slate-500">
                {project.description || "No description"}
              </p>
              <p className="mt-3 text-xs text-slate-400">Created {formatDate(project.createdAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function NewWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createWorkspace = useCreateWorkspace();
  const [name, setName] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      const workspace = await createWorkspace.mutateAsync({ name: name.trim() });
      toast.success(`Workspace "${workspace.name}" created`);
      setName("");
      onOpenChange(false);
    } catch {
      // handled globally
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New workspace">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Workspace"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || createWorkspace.isPending}>
            {createWorkspace.isPending ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
