# Seam

> Server-Driven UI protocol and management platform.
> "The seam between design and code."

Seam lets designers define and publish UI screens as versioned JSON contracts
(the **Seam Schema / UIDL**), and lets clients — Flutter, React, React Native,
or any renderer — consume those contracts and render UI independently.

## Core principles

- **One language** — all screens are defined in the Seam Schema (UIDL), a platform-agnostic JSON format.
- **Multiple origins** — screens are created manually via Studio or programmatically via the Management API.
- **Multiple renderers** — the Delivery API serves the UIDL natively or transformed via Adapters, negotiated through the HTTP `Accept` header.
- **Client autonomy** — Seam does not know about clients. Clients decide how to render (or skip) each component. Seam only manages contracts.

## What Seam is NOT

- Not a visual drag-and-drop builder with pixel-perfect layout.
- Not a client SDK or renderer — SDKs are separate packages that consume the Delivery API.
- Not a CMS — it manages UI structure and behavior contracts, not content.

## Repository

| Path | Description |
| --- | --- |
| `apps/server` | Hono + Bun API server: Management API, Delivery API, Adapter Engine, audience resolver |
| `apps/studio` | React + Vite management UI |
| `packages/schema` | Zod schemas + shared types (the UIDL) |
| `packages/adapter-stac` | Stac transformer |
| `packages/adapter-divkit` | DivKit transformer |
| `packages/sdk-js` | JavaScript Delivery API client (MIT) |

## Quick start

```sh
bun install
docker compose -f docker-compose.dev.yml up -d   # postgres + redis
bun run db:migrate
bun run --cwd apps/server seed                   # prints admin + read API keys
bun dev
```

- Studio: http://localhost:5173
- Server: http://localhost:3000
- API docs (Scalar): http://localhost:3000/v1/docs

Or run everything with Docker:

```sh
docker compose up --build
```

### First run

Open Studio (http://localhost:8080 with Docker, :5173 in dev) — on a fresh
database it shows a one-time **setup wizard** that creates your admin account
and first workspace. After that, sign-in is email + password.

- **Teammates join via invites** — there is no open registration. Workspace
  admins create invite links in *Workspace settings → Invite member* and share
  them (no SMTP required; links expire after 7 days).
- **Client apps use API keys** — create a `read` key under
  *Project settings → API Keys* and ship it with your app to consume the
  Delivery API. `admin` keys are for CI/automation against the Management API.

## Delivery API in 10 seconds

```sh
curl http://localhost:3000/v1/deliver/<projectId>/screens/home \
  -H 'X-Seam-Key: <read key>' \
  -H 'Accept: application/vnd.seam+json' \
  -H 'X-User-Id: user-123'
```

| Accept | Returns |
| --- | --- |
| `application/vnd.seam+json` | Native Seam UIDL (default) |
| `application/vnd.seam.stac+json` | Stac-compatible JSON |
| `application/vnd.seam.divkit+json` | DivKit-compatible JSON |

Response headers: `X-Seam-Snapshot`, `X-Seam-Version`, and — when an
experiment is active — `X-Seam-Experiment`, `X-Seam-Variant`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache 2.0 — SDK packages are MIT. See [LICENSE](./LICENSE).
