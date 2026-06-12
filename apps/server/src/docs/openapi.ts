// Hand-maintained OpenAPI 3.1 document for the Seam APIs, served at
// /v1/openapi.json and rendered by Scalar UI at /v1/docs.
// Keep this in sync when adding routes or adapters.

const errorResponse = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        meta: { type: "object" },
      },
      required: ["code", "message"],
    },
  },
} as const;

const seamKeyHeader = {
  name: "X-Seam-Key",
  in: "header",
  required: true,
  schema: { type: "string" },
  description: "API key. Management routes require an admin key; delivery accepts read keys.",
} as const;

function crud(tag: string, single: string, body: Record<string, unknown>) {
  return {
    post: {
      tags: [tag],
      summary: `Create ${single}`,
      parameters: [seamKeyHeader],
      requestBody: { content: { "application/json": { schema: body } } },
      responses: {
        "201": { description: "Created" },
        "409": {
          description: "DUPLICATE_NAME",
          content: { "application/json": { schema: errorResponse } },
        },
        "422": {
          description: "INVALID_SCHEMA",
          content: { "application/json": { schema: errorResponse } },
        },
      },
    },
    get: {
      tags: [tag],
      summary: `List ${tag}`,
      parameters: [seamKeyHeader],
      responses: { "200": { description: "OK" } },
    },
  };
}

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Seam API",
    version: "0.1.0",
    description:
      "Server-Driven UI protocol and management platform. Management API (admin keys) + Delivery API (read keys). All IDs are ULIDs.",
    license: { name: "Apache 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  },
  tags: [
    { name: "auth", description: "First-run setup, login, sessions (Bearer tokens)" },
    { name: "workspaces", description: "Workspaces, members, invites" },
    { name: "keys", description: "Project API keys (raw key shown once)" },
    { name: "projects" },
    { name: "components" },
    { name: "actions" },
    { name: "screens" },
    { name: "snapshots", description: "Immutable — only POST and GET" },
    { name: "publications", description: "Immutable — DELETE performs rollback" },
    {
      name: "experiments",
      description:
        "A/B experiments target a screen; each variant is a list of patches (hide node / override props / replace conditions) applied to the published base snapshot at delivery time. Control = empty patch list.",
    },
    { name: "deliver", description: "Delivery API for client renderers" },
  ],
  paths: {
    "/v1/auth/status": {
      get: {
        tags: ["auth"],
        summary: "Setup probe — { needsSetup } is true while no user exists",
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/auth/setup": {
      post: {
        tags: ["auth"],
        summary:
          "One-time first-user setup: creates instance admin + workspace, claims orphan projects",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string", minLength: 8 },
                  workspaceName: { type: "string" },
                },
                required: ["name", "email", "password"],
              },
            },
          },
        },
        responses: {
          "201": { description: "{ token, user, workspace }" },
          "409": { description: "SETUP_COMPLETE" },
        },
      },
    },
    "/v1/auth/login": {
      post: {
        tags: ["auth"],
        summary: "Email + password login → { token, user }",
        responses: { "200": { description: "OK" }, "401": { description: "Invalid credentials" } },
      },
    },
    "/v1/auth/logout": {
      post: {
        tags: ["auth"],
        summary: "Revoke the current session (Bearer)",
        responses: { "204": { description: "Logged out" } },
      },
    },
    "/v1/auth/me": {
      get: {
        tags: ["auth"],
        summary: "Current user + workspace memberships (Bearer)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/workspaces": {
      post: {
        tags: ["workspaces"],
        summary: "Create workspace (creator becomes owner)",
        responses: { "201": { description: "Created" } },
      },
      get: {
        tags: ["workspaces"],
        summary: "List the current user's workspaces",
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/workspaces/{workspaceId}/members": {
      get: {
        tags: ["workspaces"],
        summary: "List members",
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/workspaces/{workspaceId}/members/{userId}": {
      patch: {
        tags: ["workspaces"],
        summary: "Change member role (admin+; owner immutable)",
        responses: { "200": { description: "OK" }, "403": { description: "FORBIDDEN" } },
      },
      delete: {
        tags: ["workspaces"],
        summary: "Remove member (admin+; owner cannot be removed)",
        responses: { "204": { description: "Removed" } },
      },
    },
    "/v1/workspaces/{workspaceId}/invites": {
      post: {
        tags: ["workspaces"],
        summary: "Create invite (admin+) — response includes the raw token exactly once",
        responses: { "201": { description: "Created" } },
      },
      get: {
        tags: ["workspaces"],
        summary: "List pending invites (admin+)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/workspaces/{workspaceId}/invites/{inviteId}": {
      delete: {
        tags: ["workspaces"],
        summary: "Revoke invite (admin+)",
        responses: { "204": { description: "Revoked" } },
      },
    },
    "/v1/invites/{token}": {
      get: {
        tags: ["workspaces"],
        summary: "Public invite info",
        responses: {
          "200": { description: "OK" },
          "404": { description: "INVITE_NOT_FOUND" },
          "410": { description: "INVITE_EXPIRED" },
        },
      },
    },
    "/v1/invites/{token}/accept": {
      post: {
        tags: ["workspaces"],
        summary: "Join the workspace with an existing account (Bearer)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/invites/{token}/signup": {
      post: {
        tags: ["workspaces"],
        summary: "Create an account via invite (no open registration)",
        responses: {
          "201": { description: "{ token, user, workspaceId }" },
          "409": { description: "Account already exists" },
        },
      },
    },
    "/v1/projects/{projectId}/keys": {
      post: {
        tags: ["keys"],
        summary: "Create API key (workspace admin+) — raw key returned once",
        responses: { "201": { description: "Created" } },
      },
      get: {
        tags: ["keys"],
        summary: "List API keys (metadata only)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/projects/{projectId}/keys/{keyId}": {
      delete: {
        tags: ["keys"],
        summary: "Revoke API key",
        responses: { "204": { description: "Revoked" } },
      },
    },
    "/v1/projects": crud("projects", "a project", {
      type: "object",
      properties: { name: { type: "string" }, description: { type: "string" } },
      required: ["name"],
    }),
    "/v1/projects/{projectId}": {
      get: {
        tags: ["projects"],
        summary: "Get project",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" }, "404": { description: "PROJECT_NOT_FOUND" } },
      },
      patch: {
        tags: ["projects"],
        summary: "Update project",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
      delete: {
        tags: ["projects"],
        summary: "Delete project (cascades)",
        parameters: [seamKeyHeader],
        responses: { "204": { description: "Deleted" } },
      },
    },
    "/v1/projects/{projectId}/components": crud("components", "a component (PascalCase name)", {
      type: "object",
      properties: {
        name: { type: "string", pattern: "^[A-Z][a-zA-Z0-9]*$" },
        description: { type: "string" },
        props: { type: "object" },
      },
      required: ["name"],
    }),
    "/v1/projects/{projectId}/components/{componentId}": {
      get: {
        tags: ["components"],
        summary: "Get component",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
      patch: {
        tags: ["components"],
        summary: "Update component (rename not allowed)",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
      delete: {
        tags: ["components"],
        summary: "Delete component (409 COMPONENT_IN_USE if published)",
        parameters: [seamKeyHeader],
        responses: {
          "204": { description: "Deleted" },
          "409": { description: "COMPONENT_IN_USE" },
        },
      },
    },
    "/v1/projects/{projectId}/actions": crud("actions", "an action (namespace.verb name)", {
      type: "object",
      properties: {
        name: { type: "string", pattern: "^[a-z]+\\.[a-z][a-zA-Z]*$" },
        description: { type: "string" },
        params: { type: "object" },
      },
      required: ["name"],
    }),
    "/v1/projects/{projectId}/actions/{actionId}": {
      get: {
        tags: ["actions"],
        summary: "Get action",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
      patch: {
        tags: ["actions"],
        summary: "Update action",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
      delete: {
        tags: ["actions"],
        summary: "Delete action",
        parameters: [seamKeyHeader],
        responses: { "204": { description: "Deleted" } },
      },
    },
    "/v1/projects/{projectId}/screens": crud("screens", "a screen (path is slugified)", {
      type: "object",
      properties: {
        name: { type: "string" },
        path: { type: "string" },
        description: { type: "string" },
      },
      required: ["name", "path"],
    }),
    "/v1/projects/{projectId}/screens/{screenId}": {
      get: {
        tags: ["screens"],
        summary: "Get screen (enriched with status/version/experiment)",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
      patch: {
        tags: ["screens"],
        summary: "Update screen",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
      delete: {
        tags: ["screens"],
        summary: "Delete screen",
        parameters: [seamKeyHeader],
        responses: { "204": { description: "Deleted" } },
      },
    },
    "/v1/projects/{projectId}/screens/{screenId}/snapshots": {
      post: {
        tags: ["snapshots"],
        summary: "Create immutable snapshot (version auto-increments per screen)",
        parameters: [seamKeyHeader],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { tree: { type: "object" }, createdBy: { type: "string" } },
                required: ["tree"],
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "422": { description: "INVALID_SCHEMA" } },
      },
      get: {
        tags: ["snapshots"],
        summary: "List snapshots (version desc)",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/projects/{projectId}/screens/{screenId}/snapshots/{snapshotId}": {
      get: {
        tags: ["snapshots"],
        summary: "Get snapshot",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/projects/{projectId}/screens/{screenId}/publications/promote": {
      post: {
        tags: ["publications"],
        summary:
          "Promote the active publication from one channel to another (e.g. staging → production)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  from: { type: "string", enum: ["development", "staging", "production"] },
                  to: { type: "string", enum: ["development", "staging", "production"] },
                  publishedBy: { type: "string" },
                },
                required: ["from", "to"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Promoted" },
          "404": { description: "Nothing published on the source channel" },
          "409": { description: "EXPERIMENT_CONFLICT (experiment no longer active/valid)" },
        },
      },
    },
    "/v1/projects/{projectId}/screens/{screenId}/publications": {
      post: {
        tags: ["publications"],
        summary:
          "Publish a snapshot to a channel (default production), optionally with an active experiment",
        parameters: [seamKeyHeader],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  snapshotId: { type: "string" },
                  experimentId: { type: "string" },
                  publishedBy: { type: "string" },
                },
                required: ["snapshotId"],
              },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
      get: {
        tags: ["publications"],
        summary: "List publications",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/projects/{projectId}/screens/{screenId}/publications/{publicationId}": {
      delete: {
        tags: ["publications"],
        summary: "Rollback to the previous publication (record is archived, not removed)",
        parameters: [seamKeyHeader],
        responses: { "204": { description: "Rolled back" } },
      },
    },
    "/v1/projects/{projectId}/experiments": crud(
      "experiments",
      "an experiment (weights must sum to 1.0)",
      {
        type: "object",
        properties: {
          name: { type: "string" },
          strategy: { type: "object" },
          variants: { type: "array", items: { type: "object" } },
        },
        required: ["name", "strategy", "variants"],
      },
    ),
    "/v1/projects/{projectId}/experiments/{experimentId}": {
      get: {
        tags: ["experiments"],
        summary: "Get experiment (with affected screens + assignment counts)",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" } },
      },
      patch: {
        tags: ["experiments"],
        summary: "Update experiment (variants locked unless draft; 409 EXPERIMENT_CONFLICT)",
        parameters: [seamKeyHeader],
        responses: { "200": { description: "OK" }, "409": { description: "EXPERIMENT_CONFLICT" } },
      },
    },
    "/v1/deliver/{projectId}/screens/{path}": {
      get: {
        tags: ["deliver"],
        summary: "Deliver a published screen",
        description:
          "Content negotiation via Accept: application/vnd.seam+json (native, default), application/vnd.seam.stac+json, application/vnd.seam.divkit+json. Sticky A/B via X-User-Id. Release channel via X-Seam-Channel (development | staging | production; default production).",
        parameters: [
          seamKeyHeader,
          { name: "X-User-Id", in: "header", required: false, schema: { type: "string" } },
          {
            name: "X-Seam-Channel",
            in: "header",
            required: false,
            schema: { type: "string", enum: ["development", "staging", "production"] },
          },
          { name: "Accept", in: "header", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description:
              "Resolved screen payload. Headers: X-Seam-Snapshot, X-Seam-Version, X-Seam-Experiment, X-Seam-Variant.",
          },
          "404": { description: "SCREEN_NOT_FOUND | SCREEN_NOT_PUBLISHED" },
          "406": { description: "ADAPTER_NOT_FOUND" },
        },
      },
    },
    "/v1/deliver/{projectId}/screens/{path}/preview": {
      get: {
        tags: ["deliver"],
        summary: "Preview a screen with overrides (admin only)",
        parameters: [
          seamKeyHeader,
          { name: "snapshotId", in: "query", schema: { type: "string" } },
          { name: "userId", in: "query", schema: { type: "string" } },
          { name: "variant", in: "query", schema: { type: "string" } },
          { name: "adapter", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Payload plus equivalent curlCommand" } },
      },
    },
  },
} as const;
