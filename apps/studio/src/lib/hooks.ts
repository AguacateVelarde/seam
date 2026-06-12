import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { clearSessionToken, setSessionToken } from "./auth";
import type {
  Action,
  ActionParam,
  AffectedScreen,
  AllocationStrategy,
  ApiKeyInfo,
  AuthResponse,
  Channel,
  Component,
  ComponentProp,
  CreatedApiKey,
  CreatedInvite,
  Experiment,
  ExperimentDetailData,
  ExperimentStatus,
  Invite,
  InviteInfo,
  MeResponse,
  Node,
  PreviewResponse,
  Project,
  Publication,
  Screen,
  ScreenListItem,
  Snapshot,
  User,
  Variant,
  Workspace,
  WorkspaceMember,
  WorkspaceSummary,
} from "./types";

export const keys = {
  authStatus: ["auth", "status"] as const,
  me: ["auth", "me"] as const,
  workspaces: ["workspaces"] as const,
  workspaceMembers: (workspaceId: string) => ["workspaces", workspaceId, "members"] as const,
  workspaceInvites: (workspaceId: string) => ["workspaces", workspaceId, "invites"] as const,
  invite: (token: string) => ["invites", token] as const,
  apiKeys: (projectId: string) => ["projects", projectId, "keys"] as const,
  projects: ["projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  screens: (projectId: string) => ["projects", projectId, "screens"] as const,
  screen: (projectId: string, screenId: string) =>
    ["projects", projectId, "screens", screenId] as const,
  components: (projectId: string) => ["projects", projectId, "components"] as const,
  actions: (projectId: string) => ["projects", projectId, "actions"] as const,
  snapshots: (projectId: string, screenId: string) =>
    ["projects", projectId, "screens", screenId, "snapshots"] as const,
  publications: (projectId: string, screenId: string) =>
    ["projects", projectId, "screens", screenId, "publications"] as const,
  experiments: (projectId: string) => ["projects", projectId, "experiments"] as const,
  experiment: (projectId: string, experimentId: string) =>
    ["projects", projectId, "experiments", experimentId] as const,
};

/* -------------------------------- Auth -------------------------------- */

/**
 * Drop every cached query except the public auth status. Used whenever the
 * session changes (login, logout, signup, expiry) so no data leaks between
 * users — keeping the status query avoids a "connecting…" flash on the gate.
 */
export function clearUserScopedCache(qc: QueryClient) {
  qc.removeQueries({
    predicate: (query) => !(query.queryKey[0] === "auth" && query.queryKey[1] === "status"),
  });
}

export function useAuthStatus() {
  return useQuery({
    queryKey: keys.authStatus,
    queryFn: () => api<{ needsSetup: boolean }>("/v1/auth/status"),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api<MeResponse>("/v1/auth/me"),
    enabled,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<AuthResponse>("/v1/auth/login", { method: "POST", body }),
    onSuccess: (data) => {
      setSessionToken(data.token);
      clearUserScopedCache(qc);
    },
  });
}

export function useSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string; workspaceName?: string }) =>
      api<AuthResponse>("/v1/auth/setup", { method: "POST", body }),
    onSuccess: (data) => {
      setSessionToken(data.token);
      clearUserScopedCache(qc);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await api<void>("/v1/auth/logout", { method: "POST" });
      } catch {
        // Best effort — clear the local session even if the server call fails.
      }
    },
    onSettled: () => {
      clearSessionToken();
      clearUserScopedCache(qc);
    },
  });
}

/* ----------------------------- Workspaces ----------------------------- */

export function useWorkspaces() {
  return useQuery({
    queryKey: keys.workspaces,
    queryFn: () => api<WorkspaceSummary[]>("/v1/workspaces"),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api<Workspace>("/v1/workspaces", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.workspaces });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api<Workspace>(`/v1/workspaces/${workspaceId}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.workspaces });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: keys.workspaceMembers(workspaceId),
    queryFn: () => api<WorkspaceMember[]>(`/v1/workspaces/${workspaceId}/members`),
    enabled: Boolean(workspaceId),
  });
}

export function useUpdateMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "member" }) =>
      api<WorkspaceMember>(`/v1/workspaces/${workspaceId}/members/${input.userId}`, {
        method: "PATCH",
        body: { role: input.role },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspaceMembers(workspaceId) }),
  });
}

export function useRemoveMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<void>(`/v1/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspaceMembers(workspaceId) }),
  });
}

/* ------------------------------- Invites ------------------------------ */

export function useWorkspaceInvites(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: keys.workspaceInvites(workspaceId),
    queryFn: () => api<Invite[]>(`/v1/workspaces/${workspaceId}/invites`),
    enabled: Boolean(workspaceId) && enabled,
  });
}

export function useCreateInvite(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email?: string; role: "admin" | "member" }) =>
      api<CreatedInvite>(`/v1/workspaces/${workspaceId}/invites`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspaceInvites(workspaceId) }),
  });
}

export function useRevokeInvite(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<void>(`/v1/workspaces/${workspaceId}/invites/${inviteId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspaceInvites(workspaceId) }),
  });
}

export function useInviteInfo(token: string) {
  return useQuery({
    queryKey: keys.invite(token),
    queryFn: () => api<InviteInfo>(`/v1/invites/${token}`),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptInvite(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ workspaceId: string }>(`/v1/invites/${token}/accept`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.me });
      qc.invalidateQueries({ queryKey: keys.workspaces });
      qc.invalidateQueries({ queryKey: keys.projects });
    },
  });
}

export function useInviteSignup(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email?: string; password: string }) =>
      api<{ token: string; user: User; workspaceId: string }>(`/v1/invites/${token}/signup`, {
        method: "POST",
        body,
      }),
    onSuccess: (data) => {
      setSessionToken(data.token);
      clearUserScopedCache(qc);
    },
  });
}

/* ------------------------------ API keys ------------------------------ */

export function useApiKeys(projectId: string) {
  return useQuery({
    queryKey: keys.apiKeys(projectId),
    queryFn: () => api<ApiKeyInfo[]>(`/v1/projects/${projectId}/keys`),
    enabled: Boolean(projectId),
  });
}

export function useCreateApiKey(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { role: "admin" | "read"; label?: string }) =>
      api<CreatedApiKey>(`/v1/projects/${projectId}/keys`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.apiKeys(projectId) }),
  });
}

export function useRevokeApiKey(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      api<void>(`/v1/projects/${projectId}/keys/${keyId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.apiKeys(projectId) }),
  });
}

/* ------------------------------ Projects ------------------------------ */

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: () => api<Project[]>("/v1/projects"),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: keys.project(projectId),
    queryFn: () => api<Project>(`/v1/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; workspaceId: string }) =>
      api<Project>("/v1/projects", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  });
}

export function useUpdateProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; description?: string }) =>
      api<Project>(`/v1/projects/${projectId}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.projects });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api<void>(`/v1/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  });
}

/* ------------------------------- Screens ------------------------------ */

export function useScreens(projectId: string) {
  return useQuery({
    queryKey: keys.screens(projectId),
    queryFn: () => api<ScreenListItem[]>(`/v1/projects/${projectId}/screens`),
    enabled: Boolean(projectId),
  });
}

/** Enriched screen detail (ScreenListItem shape, including per-channel state). */
export function useScreen(projectId: string, screenId: string, enabled = true) {
  return useQuery({
    queryKey: keys.screen(projectId, screenId),
    queryFn: () => api<ScreenListItem>(`/v1/projects/${projectId}/screens/${screenId}`),
    enabled: Boolean(projectId && screenId) && enabled,
  });
}

export function useCreateScreen(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; path: string; description?: string }) =>
      api<Screen>(`/v1/projects/${projectId}/screens`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.screens(projectId) }),
  });
}

export function useUpdateScreen(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      screenId: string;
      body: { name?: string; path?: string; description?: string };
    }) =>
      api<Screen>(`/v1/projects/${projectId}/screens/${input.screenId}`, {
        method: "PATCH",
        body: input.body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.screens(projectId) }),
  });
}

export function useDeleteScreen(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (screenId: string) =>
      api<void>(`/v1/projects/${projectId}/screens/${screenId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.screens(projectId) }),
  });
}

/* ----------------------------- Components ----------------------------- */

export function useComponents(projectId: string) {
  return useQuery({
    queryKey: keys.components(projectId),
    queryFn: () => api<Component[]>(`/v1/projects/${projectId}/components`),
    enabled: Boolean(projectId),
  });
}

export function useCreateComponent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      props: Record<string, ComponentProp>;
    }) => api<Component>(`/v1/projects/${projectId}/components`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.components(projectId) }),
  });
}

export function useUpdateComponent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      componentId: string;
      body: { description?: string; props?: Record<string, ComponentProp> };
    }) =>
      api<Component>(`/v1/projects/${projectId}/components/${input.componentId}`, {
        method: "PATCH",
        body: input.body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.components(projectId) }),
  });
}

export function useDeleteComponent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (componentId: string) =>
      api<void>(`/v1/projects/${projectId}/components/${componentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.components(projectId) }),
  });
}

/* ------------------------------- Actions ------------------------------ */

export function useActions(projectId: string) {
  return useQuery({
    queryKey: keys.actions(projectId),
    queryFn: () => api<Action[]>(`/v1/projects/${projectId}/actions`),
    enabled: Boolean(projectId),
  });
}

export function useCreateAction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      params?: Record<string, ActionParam>;
    }) => api<Action>(`/v1/projects/${projectId}/actions`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.actions(projectId) }),
  });
}

export function useUpdateAction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      actionId: string;
      body: { description?: string; params?: Record<string, ActionParam> };
    }) =>
      api<Action>(`/v1/projects/${projectId}/actions/${input.actionId}`, {
        method: "PATCH",
        body: input.body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.actions(projectId) }),
  });
}

export function useDeleteAction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (actionId: string) =>
      api<void>(`/v1/projects/${projectId}/actions/${actionId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.actions(projectId) }),
  });
}

/* ------------------------------ Snapshots ----------------------------- */

export function useSnapshots(projectId: string, screenId: string) {
  return useQuery({
    queryKey: keys.snapshots(projectId, screenId),
    queryFn: () => api<Snapshot[]>(`/v1/projects/${projectId}/screens/${screenId}/snapshots`),
    enabled: Boolean(projectId && screenId),
  });
}

export function useCreateSnapshot(projectId: string, screenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { tree: Node; createdBy?: string }) =>
      api<Snapshot>(`/v1/projects/${projectId}/screens/${screenId}/snapshots`, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.snapshots(projectId, screenId) });
      qc.invalidateQueries({ queryKey: keys.screens(projectId) });
    },
  });
}

/* ----------------------------- Publications --------------------------- */

export function usePublications(projectId: string, screenId: string, channel?: Channel) {
  return useQuery({
    queryKey: channel
      ? ([...keys.publications(projectId, screenId), channel] as const)
      : keys.publications(projectId, screenId),
    queryFn: () =>
      api<Publication[]>(`/v1/projects/${projectId}/screens/${screenId}/publications`, {
        query: { channel },
      }),
    enabled: Boolean(projectId && screenId),
  });
}

/**
 * Refresh everything that reflects publication state: the screens list, the
 * enriched screen detail (per-channel chips) and the publication history.
 * `keys.screens` is a prefix of both, but stay explicit for clarity.
 */
function invalidatePublicationData(qc: QueryClient, projectId: string, screenId: string) {
  qc.invalidateQueries({ queryKey: keys.screens(projectId) });
  qc.invalidateQueries({ queryKey: keys.screen(projectId, screenId) });
  qc.invalidateQueries({ queryKey: keys.publications(projectId, screenId) });
}

export function useCreatePublication(projectId: string, screenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      snapshotId: string;
      experimentId?: string;
      channel?: Channel;
      publishedBy?: string;
    }) =>
      api<Publication>(`/v1/projects/${projectId}/screens/${screenId}/publications`, {
        method: "POST",
        body,
      }),
    onSuccess: () => invalidatePublicationData(qc, projectId, screenId),
  });
}

export function usePromotePublication(projectId: string, screenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { from: Channel; to: Channel; publishedBy?: string }) =>
      api<Publication>(`/v1/projects/${projectId}/screens/${screenId}/publications/promote`, {
        method: "POST",
        body,
      }),
    onSuccess: () => invalidatePublicationData(qc, projectId, screenId),
  });
}

export function useDeletePublication(projectId: string, screenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicationId: string) =>
      api<void>(`/v1/projects/${projectId}/screens/${screenId}/publications/${publicationId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidatePublicationData(qc, projectId, screenId),
  });
}

/* ----------------------------- Experiments ---------------------------- */

export function useExperiments(projectId: string) {
  return useQuery({
    queryKey: keys.experiments(projectId),
    queryFn: () => api<Experiment[]>(`/v1/projects/${projectId}/experiments`),
    enabled: Boolean(projectId),
  });
}

export function useExperiment(projectId: string, experimentId: string) {
  return useQuery({
    queryKey: keys.experiment(projectId, experimentId),
    queryFn: async (): Promise<ExperimentDetailData> => {
      const raw = await api<Record<string, unknown>>(
        `/v1/projects/${projectId}/experiments/${experimentId}`,
      );
      // Server may return either a flattened experiment or { experiment, ... }
      const base = (raw.experiment ?? raw) as Experiment;
      return {
        ...base,
        affectedScreens: (raw.affectedScreens as AffectedScreen[] | undefined) ?? [],
        assignmentCount: (raw.assignmentCount as number | null | undefined) ?? null,
      };
    },
    enabled: Boolean(projectId && experimentId),
  });
}

export function useCreateExperiment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      screenId?: string;
      strategy: AllocationStrategy;
      variants: Variant[];
    }) => api<Experiment>(`/v1/projects/${projectId}/experiments`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.experiments(projectId) }),
  });
}

export function useUpdateExperiment(projectId: string, experimentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name?: string;
      screenId?: string;
      strategy?: AllocationStrategy;
      variants?: Variant[];
      status?: ExperimentStatus;
    }) =>
      api<Experiment>(`/v1/projects/${projectId}/experiments/${experimentId}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.experiments(projectId) });
      qc.invalidateQueries({ queryKey: keys.screens(projectId) });
    },
  });
}

/* ------------------------------- Preview ------------------------------ */

export interface PreviewParams {
  snapshotId?: string;
  userId?: string;
  variant?: string;
  adapter?: string;
  channel?: Channel;
}

export function usePreview(projectId: string, path: string | undefined, params: PreviewParams) {
  return useQuery({
    queryKey: ["preview", projectId, path, params],
    queryFn: () =>
      api<PreviewResponse>(
        `/v1/deliver/${projectId}/screens/${encodeURIComponent(path ?? "")}/preview`,
        { query: { ...params } },
      ),
    enabled: Boolean(projectId && path),
    placeholderData: (previous) => previous,
  });
}
