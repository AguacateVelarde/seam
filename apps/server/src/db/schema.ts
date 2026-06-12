import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// --- Enums ---

export const experimentStatusEnum = pgEnum("experiment_status", [
  "draft",
  "active",
  "paused",
  "concluded",
]);

// --- Users & sessions ---

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // argon2id via Bun.password
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_email").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // SHA-256 of the raw bearer token
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("sessions_token_hash").on(table.tokenHash)],
);

// --- Workspaces ---

export const workspaceRoleEnum = pgEnum("workspace_role", ["owner", "admin", "member"]);

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("workspace_members_pk").on(table.workspaceId, table.userId)],
);

export const invites = pgTable(
  "invites",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email"),
    role: text("role", { enum: ["admin", "member"] }).notNull(),
    // SHA-256 of the raw invite token (the raw token is only shown once)
    tokenHash: text("token_hash").notNull(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("invites_token_hash").on(table.tokenHash)],
);

// --- Projects ---

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  // Nullable for pre-workspace rows; orphans are claimed by the first-run setup.
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Components ---

export const components = pgTable(
  "components",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // JSON: Record<string, ComponentProp>
    props: jsonb("props").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("components_project_name").on(table.projectId, table.name)],
);

// --- Actions ---

export const actions = pgTable(
  "actions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // JSON: Record<string, ActionParam>
    params: jsonb("params").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("actions_project_name").on(table.projectId, table.name)],
);

// --- Screens ---

export const screens = pgTable(
  "screens",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    path: text("path").notNull(), // e.g. "home", "credit-detail"
    description: text("description"),
    activePublicationId: text("active_publication_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("screens_project_path").on(table.projectId, table.path)],
);

// --- Snapshots (immutable) ---

export const snapshots = pgTable(
  "snapshots",
  {
    id: text("id").primaryKey(),
    screenId: text("screen_id")
      .notNull()
      .references(() => screens.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // JSON: Node (the full UIDL tree)
    tree: jsonb("tree").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (table) => [uniqueIndex("snapshots_screen_version").on(table.screenId, table.version)],
);

// --- Experiments ---

export const experiments = pgTable("experiments", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // JSON: AllocationStrategy
  strategy: jsonb("strategy").notNull(),
  // JSON: Variant[]
  variants: jsonb("variants").notNull(),
  status: experimentStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Publications (immutable) ---

export const publications = pgTable(
  "publications",
  {
    id: text("id").primaryKey(),
    screenId: text("screen_id")
      .notNull()
      .references(() => screens.id, { onDelete: "cascade" }),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshots.id),
    experimentId: text("experiment_id").references(() => experiments.id),
    isDefault: boolean("is_default").default(false).notNull(),
    publishedAt: timestamp("published_at").defaultNow().notNull(),
    publishedBy: text("published_by"),
  },
  (table) => [index("publications_screen_id").on(table.screenId)],
);

// --- API Keys ---

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // "admin" can use Management API. "read" can only use Delivery API.
    role: text("role", { enum: ["admin", "read"] }).notNull(),
    keyHash: text("key_hash").notNull(), // SHA-256 of the raw key
    label: text("label"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("api_keys_hash").on(table.keyHash)],
);
