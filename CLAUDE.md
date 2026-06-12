# Seam — agent guide

Server-Driven UI (SDUI) platform: designers publish screens as versioned JSON
contracts (the "UIDL"); clients (Flutter/React/anything) fetch and render them
via the Delivery API. Bun + Turborepo monorepo, Apache 2.0 (SDKs MIT).

## Commands

All from the repo root unless noted. Bun only — never npm/yarn/pnpm.

| Task | Command |
| --- | --- |
| Install | `bun install` (root only — workspaces) |
| Dev (server :3000 + studio :5173) | `bun dev` |
| Full pipeline (do this before declaring done) | `bunx turbo build typecheck test` |
| Lint/format (Biome, autofix) | `bunx biome check --write .` |
| One package | `cd apps/server && bunx tsc --noEmit` / `bun test src` |
| DB migration from schema change | `cd apps/server && bunx drizzle-kit generate` (then review the SQL; hand-add data migrations) |
| API integration test (needs scratch DB) | `DATABASE_URL=postgres://seam:seam@localhost:5434/seam bun run --cwd apps/server e2e` |
| Apply migrations | `bun run db:migrate` (or automatic in Docker via `SEAM_AUTO_MIGRATE=true`) |
| Docker stack (server :3000, studio :8080) | `docker compose up -d --build` |

## Architecture (where to change things)

- `packages/schema` — **single source of truth**: all Zod schemas + TS types
  (UIDL nodes, components, experiments, channels, auth, request bodies).
  Any contract change starts here; server and studio import from `@seam/schema`.
- `apps/server` — Hono API. `src/routes/*` (one router per resource, mounted in
  `src/index.ts`), `src/services/*` (audience resolver, adapters, channels,
  sessions, sticky store), `src/db/schema.ts` (Drizzle) + `src/db/migrations/`.
- `apps/studio` — React 18 + Vite + Tailwind v4 + TanStack Query + Zustand.
  `src/lib/api.ts` (fetch wrapper) / `hooks.ts` (query hooks — add new endpoints
  here with proper invalidations), `src/features/*` per domain,
  `src/store/editor.ts` (screen editor tree state), `src/components/ui/*` primitives.
- `packages/adapter-*` — transform `SeamResponse` to other SDUI formats.
  Register new ones in `apps/server/src/index.ts`.
- `packages/sdk-js` — client for the Delivery API (MIT licensed).

## Core invariants (do not break)

- **Snapshots and publications are immutable.** No UPDATE/DELETE on snapshots;
  publication DELETE = channel-scoped rollback (re-point, never remove rows).
- **Channels**: `development → staging → production`. Per-screen active
  publication lives in `screen_channels`, not on the screen row. Delivery
  defaults to production (`X-Seam-Channel` header opts into others).
- **Experiments are patch-based**: a variant = list of patches
  (`hide` / `setProps` / `setConditions`) applied to the published base
  snapshot at delivery time. Variants/strategy/name/screenId editable only in
  `draft` status. Patches are validated against the snapshot at publish time.
- **Auth is two-track**: user sessions (`Authorization: Bearer`, Studio) and
  project-scoped API keys (`X-Seam-Key`; `read` = Delivery only, `admin` =
  that project's Management API). Workspace roles: owner > admin > member —
  destructive ops (project delete, key management, invites) need admin+.
  No open signup; users join via invite tokens. Secrets are stored hashed only.
- **IDs are ULIDs** (`ulid` package), never UUIDs. Snapshot versions
  auto-increment per screen inside a transaction.
- Component names PascalCase; action names `namespace.verb` — enforced by Zod.
- Errors always use the envelope `{ error: { code, message, meta? } }` via
  `SeamError` + the `app.onError` handler. New codes go in `lib/errors.ts`.

## Conventions & gotchas

- Hono sub-routers type mount-path params as `string | undefined` — use the
  `param(c, "name")` helper, never raw `c.req.param()` in routes.
- Thrown errors must bubble to `app.onError` — don't add per-router try/catch
  middleware (sub-router errors bypass parent middleware in Hono).
- Validate request bodies with `parseBody(Schema, body)` → throws 422
  INVALID_SCHEMA with Zod issues in `meta`.
- Serialize DB rows with `serializeRow/serializeRows` (Date → ISO string) so
  responses match the shared schema types.
- Zod `.default()` makes the field **required in the inferred input type**
  (e.g. `Variant.patches`) — fixture/object literals must include it.
- Studio env vars (`VITE_*`) are baked at **build** time — in Docker they're
  build args, not runtime env.
- After editing TS, run Biome before finishing; CI-equivalent gate is
  `bunx turbo build typecheck test` (17 tasks, all must pass).
- Tests are colocated `*.test.ts`, run with `bun test`. A package with a test
  script but zero test files fails — add a test when adding a package.

## Verifying server changes for real (recipe)

Unit tests don't cover routes. For behavior changes, spin a scratch DB:

```sh
docker run --rm -d --name seam-test-pg -p 5434:5432 \
  -e POSTGRES_USER=seam -e POSTGRES_PASSWORD=seam -e POSTGRES_DB=seam postgres:16-alpine
cd apps/server
DATABASE_URL=postgres://seam:seam@localhost:5434/seam bunx drizzle-kit migrate
DATABASE_URL=postgres://seam:seam@localhost:5434/seam PORT=3199 bun src/index.ts &
# Bootstrap: POST /v1/auth/setup {name,email,password} → token; then exercise
# endpoints with curl. Kill the server and `docker rm -f seam-test-pg` after.
```

Machine-specific notes (local ports, running stacks) live in `CLAUDE.local.md`
(gitignored) — read it if present.
