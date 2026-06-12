import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().ulid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const WorkspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const WorkspaceSchema = z.object({
  id: z.string().ulid(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceMemberSchema = z.object({
  workspaceId: z.string().ulid(),
  userId: z.string().ulid(),
  role: WorkspaceRoleSchema,
  createdAt: z.string().datetime(),
  // joined user info for member lists
  email: z.string().email().optional(),
  name: z.string().optional(),
});

export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const InviteSchema = z.object({
  id: z.string().ulid(),
  workspaceId: z.string().ulid(),
  email: z.string().email().nullish(),
  role: z.enum(["admin", "member"]),
  invitedBy: z.string().nullish(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullish(),
  createdAt: z.string().datetime(),
});

export type Invite = z.infer<typeof InviteSchema>;

// --- Request schemas ---

const password = z.string().min(8, "Password must be at least 8 characters");

export const SetupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password,
  workspaceName: z.string().min(1).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
});

export const CreateInviteSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const UpdateMemberSchema = z.object({
  role: WorkspaceRoleSchema,
});

export const InviteSignupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(), // required when the invite has no email
  password,
});

export const CreateApiKeySchema = z.object({
  role: z.enum(["admin", "read"]),
  label: z.string().optional(),
});

export const ApiKeyInfoSchema = z.object({
  id: z.string().ulid(),
  projectId: z.string().ulid(),
  role: z.enum(["admin", "read"]),
  label: z.string().nullish(),
  createdAt: z.string().datetime(),
});

export type ApiKeyInfo = z.infer<typeof ApiKeyInfoSchema>;
