# Contributing to Seam

Thanks for your interest in contributing! Seam is an open source Server-Driven UI
protocol and management platform — "the seam between design and code."

## Getting started

Prerequisites: Bun >= 1.1, Docker, Docker Compose

1. Clone the repo
2. Run `bun install`
3. Run `docker compose -f docker-compose.dev.yml up -d` (starts postgres + redis)
4. Run `bun run db:migrate`
5. Run `bun dev`

Studio: http://localhost:5173
Server: http://localhost:3000
API docs: http://localhost:3000/v1/docs (Scalar UI)

## First run & auth

Open Studio on a fresh database and the setup wizard creates the first user
(instance admin) and a workspace. Further users join via invite links created
in Workspace settings — there is no open registration.

Studio authenticates with session tokens (email + password). API keys are for
machines: `read` keys consume the Delivery API, `admin` keys drive the
Management API (CI/automation) — manage them under Project settings → API
Keys, or seed a throwaway project + keys with `bun run --cwd apps/server seed`.

## Repository layout

- `apps/server` — Hono + Bun API server (Management API, Delivery API, Adapter Engine)
- `apps/studio` — React + Vite management UI
- `packages/schema` — Zod schemas and shared TypeScript types (the Seam UIDL)
- `packages/adapter-stac` — Stac transformer
- `packages/adapter-divkit` — DivKit transformer
- `packages/sdk-js` — JavaScript helper for consuming the Delivery API

## Commit conventions

Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`

## Adding an Adapter

1. Create `packages/adapter-{name}/`
2. Implement the `SeamAdapter` interface from `@seam/schema`
3. Export your adapter class
4. Register it in `apps/server/src/index.ts`
5. Add `application/vnd.seam.{name}+json` to the OpenAPI spec
6. Add tests in `packages/adapter-{name}/src/index.test.ts`

## Versioning & releases

We use [Changesets](https://github.com/changesets/changesets). Run `bunx changeset`
to describe your change when touching published packages.

## License

The repository is licensed under Apache 2.0. SDK packages (`packages/sdk-js`,
future `sdk-flutter`) are MIT-licensed to maximize adoption.
