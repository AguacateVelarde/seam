// End-to-end API smoke test. Boots the real server in-process against
// DATABASE_URL (migrations auto-applied), then exercises the core flows over
// HTTP: setup → auth → project/screen/snapshot → channels → promote →
// experiments → adapters → invites → rollback. Exits non-zero on failure.
//
// Local:  docker run --rm -d --name seam-test-pg -p 5434:5432 \
//           -e POSTGRES_USER=seam -e POSTGRES_PASSWORD=seam -e POSTGRES_DB=seam postgres:16-alpine
//         DATABASE_URL=postgres://seam:seam@localhost:5434/seam bun run e2e
// CI:     runs against a postgres service container (fresh DB each run).

import { ulid } from "ulid";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (point it at a DISPOSABLE database)");
  process.exit(1);
}
process.env.SEAM_AUTO_MIGRATE = "true";
process.env.SEAM_AUTO_SEED = "false";
// Deliberately NOT process.env.PORT — Bun auto-loads apps/server/.env, which
// would collide with a locally running server.
const PORT = Number(process.env.E2E_PORT) || 3199;
const BASE = `http://localhost:${PORT}`;

const serverModule = await import("../src/index");
const server = Bun.serve({ port: PORT, fetch: serverModule.default.fetch });

let passed = 0;
function ok(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    if (detail !== undefined) console.error("    ", JSON.stringify(detail).slice(0, 500));
    server.stop(true);
    process.exit(1);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: test script traverses ad-hoc response shapes
type Json = Record<string, any>;
async function req(
  method: string,
  path: string,
  opts: { token?: string; key?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<{ status: number; json: Json; headers: Headers }> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.key) headers["X-Seam-Key"] = opts.key;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: Json = {};
  try {
    json = (await res.json()) as Json;
  } catch {
    /* 204s */
  }
  return { status: res.status, json, headers: res.headers };
}

console.log("auth & workspace");
{
  const status = await req("GET", "/v1/auth/status");
  ok(status.json.needsSetup === true, "fresh DB needs setup");
}
const setup = await req("POST", "/v1/auth/setup", {
  body: {
    name: "E2E",
    email: "e2e@seam.test",
    password: "e2e-password-1",
    workspaceName: "E2E WS",
  },
});
ok(setup.status === 201 && !!setup.json.token, "setup creates first user", setup.json);
const token = setup.json.token as string;
const workspaceId = setup.json.workspace.id as string;
{
  const again = await req("POST", "/v1/auth/setup", {
    body: { name: "X", email: "x@seam.test", password: "password123" },
  });
  ok(again.status === 409, "second setup rejected (409)", again.json);
  const bad = await req("POST", "/v1/auth/login", {
    body: { email: "e2e@seam.test", password: "wrong-password" },
  });
  ok(bad.status === 401, "wrong password rejected (401)");
}

console.log("project, screen, snapshot, keys");
const project = await req("POST", "/v1/projects", {
  token,
  body: { name: "E2E App", workspaceId },
});
ok(project.status === 201, "project created", project.json);
const pid = project.json.id as string;
const screen = await req("POST", `/v1/projects/${pid}/screens`, {
  token,
  body: { name: "Home", path: "Home Page" },
});
ok(screen.json.path === "home-page", "screen path slugified", screen.json);
const sid = screen.json.id as string;

const rootId = ulid();
const cardId = ulid();
const bannerId = ulid();
const tree = {
  id: rootId,
  component: "Page",
  props: {},
  slots: {
    body: [
      {
        id: cardId,
        component: "HeroCard",
        props: {
          title: { type: "static", value: "Welcome" },
          color: { type: "static", value: "blue" },
        },
      },
      { id: bannerId, component: "PromoBanner", props: {} },
    ],
  },
};
const snap = await req("POST", `/v1/projects/${pid}/screens/${sid}/snapshots`, {
  token,
  body: { tree },
});
ok(snap.status === 201 && snap.json.version === 1, "snapshot v1 created", snap.json);
const snapshotId = snap.json.id as string;
{
  const invalid = await req("POST", `/v1/projects/${pid}/screens/${sid}/snapshots`, {
    token,
    body: { tree: { id: "not-a-ulid", component: "", props: {} } },
  });
  ok(invalid.status === 422, "invalid tree rejected (422 INVALID_SCHEMA)");
}
const keyRes = await req("POST", `/v1/projects/${pid}/keys`, {
  token,
  body: { role: "read", label: "e2e" },
});
ok(keyRes.status === 201 && keyRes.json.key.startsWith("sk_read_"), "read key created");
const readKey = keyRes.json.key as string;

console.log("channels");
{
  const pub = await req("POST", `/v1/projects/${pid}/screens/${sid}/publications`, {
    token,
    body: { snapshotId, channel: "development" },
  });
  ok(pub.status === 201, "published to development", pub.json);
  const prod = await req("GET", `/v1/deliver/${pid}/screens/home-page`, { key: readKey });
  ok(
    prod.status === 404 && prod.json.error?.code === "SCREEN_NOT_PUBLISHED",
    "production isolated",
  );
  const dev = await req("GET", `/v1/deliver/${pid}/screens/home-page`, {
    key: readKey,
    headers: { "X-Seam-Channel": "development" },
  });
  ok(
    dev.status === 200 && dev.headers.get("X-Seam-Channel") === "development",
    "development serves",
  );
  const promote1 = await req("POST", `/v1/projects/${pid}/screens/${sid}/publications/promote`, {
    token,
    body: { from: "development", to: "staging" },
  });
  const promote2 = await req("POST", `/v1/projects/${pid}/screens/${sid}/publications/promote`, {
    token,
    body: { from: "staging", to: "production" },
  });
  ok(promote1.status === 201 && promote2.status === 201, "promoted dev → staging → production");
  const prodNow = await req("GET", `/v1/deliver/${pid}/screens/home-page`, { key: readKey });
  ok(prodNow.status === 200 && prodNow.json.version === 1, "production serves after promote");
}

console.log("auth separation");
{
  const mgmt = await req("POST", `/v1/projects/${pid}/screens`, {
    key: readKey,
    body: { name: "X", path: "x" },
  });
  ok(mgmt.status === 403, "read key rejected on management (403)");
  const none = await req("GET", `/v1/projects/${pid}/screens`, {});
  ok(none.status === 401, "no credentials rejected (401)");
}

console.log("patch experiments");
{
  const exp = await req("POST", `/v1/projects/${pid}/experiments`, {
    token,
    body: {
      name: "e2e_exp",
      screenId: sid,
      strategy: { type: "user_id", header: "X-User-Id", sticky: true },
      variants: [
        { id: ulid(), name: "control", weight: 0.5, patches: [] },
        {
          id: ulid(),
          name: "treatment",
          weight: 0.5,
          patches: [
            { op: "hide", nodeId: bannerId },
            { op: "setProps", nodeId: cardId, props: { color: { type: "static", value: "red" } } },
          ],
        },
      ],
    },
  });
  ok(exp.status === 201, "patch experiment created", exp.json);
  const expId = exp.json.id as string;
  const activate = await req("PATCH", `/v1/projects/${pid}/experiments/${expId}`, {
    token,
    body: { status: "active" },
  });
  ok(activate.status === 200, "experiment activated");
  const lock = await req("PATCH", `/v1/projects/${pid}/experiments/${expId}`, {
    token,
    body: { variants: [] },
  });
  ok(lock.status !== 200, "variants locked while active");
  const pub = await req("POST", `/v1/projects/${pid}/screens/${sid}/publications`, {
    token,
    body: { snapshotId, channel: "production", experimentId: expId },
  });
  ok(pub.status === 201, "published with experiment");

  // Deterministic stickiness + both variants reachable
  const variants = new Set<string>();
  for (const user of ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"]) {
    const first = await req("GET", `/v1/deliver/${pid}/screens/home-page`, {
      key: readKey,
      headers: { "X-User-Id": user },
    });
    const second = await req("GET", `/v1/deliver/${pid}/screens/home-page`, {
      key: readKey,
      headers: { "X-User-Id": user },
    });
    const variant = first.headers.get("X-Seam-Variant") ?? "";
    ok(variant === second.headers.get("X-Seam-Variant"), `variant sticky for ${user} (${variant})`);
    variants.add(variant);
    if (variant === "treatment") {
      const body = first.json.tree.slots.body as Json[];
      ok(body.length === 1 && body[0].props.color.value === "red", "treatment patches applied");
    }
  }
  ok(variants.size === 2, "both variants observed across users", [...variants]);
}

console.log("adapters");
{
  const stac = await req("GET", `/v1/deliver/${pid}/screens/home-page`, {
    key: readKey,
    headers: { Accept: "application/vnd.seam.stac+json" },
  });
  ok(stac.status === 200 && stac.json.version === "1.0", "stac adapter");
  const unknown = await req("GET", `/v1/deliver/${pid}/screens/home-page`, {
    key: readKey,
    headers: { Accept: "application/vnd.seam.flutter+json" },
  });
  ok(unknown.status === 406, "unknown adapter rejected (406)");
}

console.log("invites");
{
  const invite = await req("POST", `/v1/workspaces/${workspaceId}/invites`, {
    token,
    body: { role: "member" },
  });
  ok(invite.status === 201 && !!invite.json.token, "invite created");
  const signup = await req("POST", `/v1/invites/${invite.json.token}/signup`, {
    body: { name: "Member", email: "member@seam.test", password: "member-pass-1" },
  });
  ok(signup.status === 201, "signup via invite", signup.json);
  const reuse = await req("GET", `/v1/invites/${invite.json.token}`);
  ok(reuse.status === 404, "invite single-use");
  const forbidden = await req("POST", `/v1/workspaces/${workspaceId}/invites`, {
    token: signup.json.token,
    body: { role: "member" },
  });
  ok(forbidden.status === 403, "member cannot invite (403)");
}

console.log("rollback");
{
  const pubs = await req(
    "GET",
    `/v1/projects/${pid}/screens/${sid}/publications?channel=production`,
    {
      token,
    },
  );
  const latest = (pubs.json as unknown as Json[])[0];
  const rollback = await req(
    "DELETE",
    `/v1/projects/${pid}/screens/${sid}/publications/${latest.id}`,
    { token },
  );
  ok(rollback.status === 204, "rollback returns 204");
  const after = await req("GET", `/v1/deliver/${pid}/screens/home-page`, { key: readKey });
  ok(
    after.status === 200 && !after.headers.get("X-Seam-Experiment"),
    "production rolled back to pre-experiment publication",
  );
}

console.log(`\nAll ${passed} assertions passed.`);
server.stop(true);
process.exit(0);
