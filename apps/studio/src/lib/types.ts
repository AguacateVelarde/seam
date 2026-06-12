export type {
  Action,
  ActionParam,
  AllocationStrategy,
  ApiKeyInfo,
  Component,
  ComponentProp,
  ConditionRule,
  Experiment,
  ExperimentStatus,
  Invite,
  Node,
  Project,
  PropType,
  PropValue,
  Publication,
  Screen,
  ScreenListItem,
  ScreenStatus,
  Snapshot,
  User,
  Variant,
  VariantPatch,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from "@seam/schema";

export { actionNameRegex, componentNameRegex, slugifyPath } from "@seam/schema";

import type { Experiment, User, Workspace, WorkspaceRole } from "@seam/schema";

/* ------------------------------ Auth & workspaces ------------------------------ */

/** Response of GET /v1/auth/me */
export interface MeResponse {
  user: User;
  workspaces: WorkspaceSummary[];
}

/** Workspace entry as returned by GET /v1/workspaces and /v1/auth/me */
export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  createdAt?: string;
}

/** Response of POST /v1/auth/login and /v1/auth/setup */
export interface AuthResponse {
  token: string;
  user: User;
  workspace?: Workspace;
}

/** Response of GET /v1/invites/:token */
export interface InviteInfo {
  workspaceName: string;
  email: string | null;
  role: "admin" | "member";
  expiresAt: string;
}

/** Response of POST /v1/workspaces/:id/invites — raw token returned once */
export interface CreatedInvite {
  id: string;
  workspaceId: string;
  email: string | null;
  role: "admin" | "member";
  expiresAt: string;
  createdAt: string;
  token: string;
}

/** Response of POST /v1/projects/:projectId/keys — raw key returned once */
export interface CreatedApiKey {
  id: string;
  projectId: string;
  role: "admin" | "read";
  label?: string | null;
  createdAt: string;
  key: string;
}

/** Screen affected by an experiment, as returned by GET /experiments/:id */
export interface AffectedScreen {
  id: string;
  name: string;
  path: string;
}

/** Experiment detail payload (experiment + affected screens + assignments) */
export type ExperimentDetailData = Experiment & {
  affectedScreens: AffectedScreen[];
  assignmentCount: number | null;
};

/** Response of GET /v1/deliver/:pid/screens/:path/preview */
export interface PreviewResponse {
  curlCommand: string;
  experiment?: string | { id?: string; name?: string } | null;
  variant?: string | { id?: string; name?: string } | null;
  payload: unknown;
}

export type ComponentPropType =
  | "string"
  | "number"
  | "boolean"
  | "currency"
  | "url"
  | "action"
  | "enum"
  | "slot";

export type ActionParamType = "string" | "number" | "boolean" | "enum";
