import { ArrowLeft, Lock, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { CopyField } from "../../components/ui/CopyField";
import { Dialog } from "../../components/ui/Dialog";
import { Field, Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { formatDate } from "../../lib/format";
import {
  useCreateInvite,
  useMe,
  useRemoveMember,
  useRevokeInvite,
  useUpdateMember,
  useUpdateWorkspace,
  useWorkspaceInvites,
  useWorkspaceMembers,
} from "../../lib/hooks";
import type { CreatedInvite, WorkspaceMember } from "../../lib/types";
import { toast } from "../../store/toast";

export function WorkspaceSettings() {
  const { workspaceId = "" } = useParams();
  const { data: me } = useMe();

  const workspace = me?.workspaces.find((w) => w.id === workspaceId);
  const viewerRole = workspace?.role;
  const canManage = viewerRole === "owner" || viewerRole === "admin";

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/projects"
          className="mb-6 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft size={12} />
          Back to projects
        </Link>
        <h1 className="mb-6 text-lg font-semibold text-slate-900">
          {workspace ? `${workspace.name} settings` : "Workspace settings"}
        </h1>

        <WorkspaceNameCard
          workspaceId={workspaceId}
          currentName={workspace?.name ?? ""}
          disabled={!canManage}
        />
        <MembersCard workspaceId={workspaceId} canManage={canManage} />
        {canManage && <InvitesCard workspaceId={workspaceId} />}
      </main>
    </div>
  );
}

/* ----------------------------- Workspace name ----------------------------- */

function WorkspaceNameCard({
  workspaceId,
  currentName,
  disabled,
}: {
  workspaceId: string;
  currentName: string;
  disabled: boolean;
}) {
  const updateWorkspace = useUpdateWorkspace(workspaceId);
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await updateWorkspace.mutateAsync({ name: name.trim() });
      toast.success("Workspace renamed");
    } catch {
      // handled globally
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <Field
        label="Workspace name"
        hint={disabled ? "Only workspace admins can rename the workspace." : undefined}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} />
      </Field>
      {!disabled && (
        <div className="mt-4 flex justify-end">
          <Button
            type="submit"
            disabled={!name.trim() || name.trim() === currentName || updateWorkspace.isPending}
          >
            {updateWorkspace.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </form>
  );
}

/* -------------------------------- Members -------------------------------- */

function MembersCard({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const { data: members, isLoading } = useWorkspaceMembers(workspaceId);
  const updateMember = useUpdateMember(workspaceId);
  const removeMember = useRemoveMember(workspaceId);
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);

  async function handleRoleChange(member: WorkspaceMember, role: "admin" | "member") {
    try {
      await updateMember.mutateAsync({ userId: member.userId, role });
      toast.success(
        `${member.name ?? member.email ?? "Member"} is now ${role === "admin" ? "an admin" : "a member"}`,
      );
    } catch {
      // handled globally
    }
  }

  async function handleRemove() {
    if (!removing) return;
    try {
      await removeMember.mutateAsync(removing.userId);
      toast.success(`Removed ${removing.name ?? removing.email ?? "member"}`);
      setRemoving(null);
    } catch {
      // handled globally
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Members</h2>
      </div>
      {isLoading ? (
        <p className="px-5 py-4 text-sm text-slate-500">Loading members…</p>
      ) : !members || members.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">No members yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {member.name || member.email || member.userId}
                </p>
                {member.email && <p className="truncate text-xs text-slate-400">{member.email}</p>}
              </div>
              {member.role === "owner" ? (
                <Badge tone="purple" className="gap-1">
                  <Lock size={10} />
                  Owner
                </Badge>
              ) : canManage ? (
                <>
                  <Select
                    className="w-28"
                    value={member.role}
                    onChange={(e) => handleRoleChange(member, e.target.value as "admin" | "member")}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-red-600"
                    title="Remove member"
                    onClick={() => setRemoving(member)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </>
              ) : (
                <Badge tone={member.role === "admin" ? "blue" : "gray"}>{member.role}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove member"
      >
        <p className="text-sm text-slate-600">
          Remove{" "}
          <span className="font-medium">{removing?.name || removing?.email || "this member"}</span>{" "}
          from the workspace? They will lose access to all of its projects.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRemove} disabled={removeMember.isPending}>
            {removeMember.isPending ? "Removing…" : "Remove"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/* -------------------------------- Invites -------------------------------- */

function InvitesCard({ workspaceId }: { workspaceId: string }) {
  const { data: invites, isLoading } = useWorkspaceInvites(workspaceId);
  const revokeInvite = useRevokeInvite(workspaceId);
  const [inviteOpen, setInviteOpen] = useState(false);

  async function handleRevoke(inviteId: string) {
    try {
      await revokeInvite.mutateAsync(inviteId);
      toast.success("Invite revoked");
    } catch {
      // handled globally
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Invites</h2>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Plus size={13} />
          Invite member
        </Button>
      </div>
      {isLoading ? (
        <p className="px-5 py-4 text-sm text-slate-500">Loading invites…</p>
      ) : !invites || invites.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">No pending invites.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {invite.email || "Link invite"}
                </p>
                <p className="text-xs text-slate-400">Expires {formatDate(invite.expiresAt)}</p>
              </div>
              <Badge tone={invite.role === "admin" ? "blue" : "gray"}>{invite.role}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-red-600"
                title="Revoke invite"
                onClick={() => handleRevoke(invite.id)}
                disabled={revokeInvite.isPending}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <InviteDialog workspaceId={workspaceId} open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function InviteDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createInvite = useCreateInvite(workspaceId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Reset for the next invite once closed.
      setEmail("");
      setRole("member");
      setCreated(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const invite = await createInvite.mutateAsync({
        email: email.trim() || undefined,
        role,
      });
      setCreated(invite);
    } catch {
      // handled globally
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title="Invite member">
      {created ? (
        <div>
          <p className="text-sm text-slate-600">
            Share this link with{" "}
            <span className="font-medium">{created.email || "your teammate"}</span> to let them join
            the workspace as {created.role === "admin" ? "an admin" : "a member"}.
          </p>
          <CopyField value={`${window.location.origin}/invite/${created.token}`} />
          <p className="mt-2 text-xs text-slate-400">
            This link is shown once and expires in 7 days.
          </p>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email (optional)" hint="Leave empty to create a shareable link invite.">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createInvite.isPending}>
              {createInvite.isPending ? "Creating…" : "Create invite"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
