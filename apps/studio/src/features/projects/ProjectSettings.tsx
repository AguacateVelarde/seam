import { KeyRound, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { CopyField } from "../../components/ui/CopyField";
import { Dialog } from "../../components/ui/Dialog";
import { Field, Input, Textarea } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ApiError } from "../../lib/api";
import { formatDate } from "../../lib/format";
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteProject,
  useProject,
  useRevokeApiKey,
  useUpdateProject,
} from "../../lib/hooks";
import type { ApiKeyInfo, CreatedApiKey } from "../../lib/types";
import { toast } from "../../store/toast";

export function ProjectSettings() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const deleteProject = useDeleteProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
  }, [project]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await updateProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Project updated");
    } catch {
      // handled globally
    }
  }

  async function handleDelete() {
    try {
      await deleteProject.mutateAsync(projectId);
      toast.success("Project deleted");
      navigate("/projects");
    } catch {
      // handled globally
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Settings</h1>

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <Field label="Project name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={!name.trim() || updateProject.isPending}>
            {updateProject.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <ApiKeysCard projectId={projectId} />

      <div className="mt-8 rounded-lg border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-500">
          Deleting a project permanently removes its screens, components, actions, and experiments.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setConfirmOpen(true)}>
          Delete project
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Delete project">
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <span className="font-medium">{project?.name}</span>? This
          cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleteProject.isPending}>
            {deleteProject.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/* -------------------------------- API keys -------------------------------- */

function ApiKeysCard({ projectId }: { projectId: string }) {
  const { data: apiKeys, isLoading, error } = useApiKeys(projectId);
  const revokeKey = useRevokeApiKey(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyInfo | null>(null);

  const forbidden = error instanceof ApiError && error.status === 403;

  async function handleRevoke() {
    if (!revoking) return;
    try {
      await revokeKey.mutateAsync(revoking.id);
      toast.success("API key revoked");
      setRevoking(null);
    } catch {
      // handled globally
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <KeyRound size={15} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">API keys</h2>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={13} />
          Create key
        </Button>
      </div>
      <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
        Read keys are for client apps consuming the Delivery API; admin keys are for CI and
        automation against the Management API.
      </p>

      {isLoading ? (
        <p className="px-5 py-4 text-sm text-slate-500">Loading keys…</p>
      ) : forbidden ? (
        <p className="px-5 py-4 text-sm text-slate-500">
          Only workspace admins can manage API keys for this project.
        </p>
      ) : !apiKeys || apiKeys.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">No API keys yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {apiKeys.map((apiKey) => (
            <li key={apiKey.id} className="flex items-center gap-3 px-5 py-3">
              <Badge tone={apiKey.role === "admin" ? "purple" : "blue"}>{apiKey.role}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {apiKey.label || "Untitled key"}
                </p>
                <p className="text-xs text-slate-400">Created {formatDate(apiKey.createdAt)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-red-600"
                title="Revoke key"
                onClick={() => setRevoking(apiKey)}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CreateKeyDialog projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog
        open={Boolean(revoking)}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Revoke API key"
      >
        <p className="text-sm text-slate-600">
          Revoke <span className="font-medium">{revoking?.label || "this key"}</span>? Any client or
          automation using it will immediately lose access.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRevoking(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRevoke} disabled={revokeKey.isPending}>
            {revokeKey.isPending ? "Revoking…" : "Revoke"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function CreateKeyDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createKey = useCreateApiKey(projectId);
  const [role, setRole] = useState<"admin" | "read">("read");
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setRole("read");
      setLabel("");
      setCreated(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const key = await createKey.mutateAsync({ role, label: label.trim() || undefined });
      setCreated(key);
    } catch {
      // handled globally
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title="Create API key">
      {created ? (
        <div>
          <p className="text-sm text-slate-600">
            Your new <span className="font-medium">{created.role}</span> key is ready.
          </p>
          <CopyField value={created.key} />
          <p className="mt-2 text-xs font-medium text-yellow-700">
            This key is shown only once — copy it now and store it somewhere safe.
          </p>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Role"
            hint={
              role === "read"
                ? "Read keys can only call the Delivery API."
                : "Admin keys have full access to the Management API — use for CI/automation."
            }
          >
            <Select value={role} onChange={(e) => setRole(e.target.value as "admin" | "read")}>
              <option value="read">Read</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label="Label (optional)">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. iOS app, GitHub Actions"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createKey.isPending}>
              {createKey.isPending ? "Creating…" : "Create key"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
