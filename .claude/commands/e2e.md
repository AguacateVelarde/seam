---
description: Spin up a scratch DB and smoke-test the server API end-to-end
---

Stand up a disposable environment and verify the server's core flows over HTTP
(unit tests don't cover routes). Use the scratch-DB recipe from CLAUDE.md
(postgres on :5434, server on :3199). Then, with curl:

1. `POST /v1/auth/setup` → token; create a project + screen + snapshot.
2. Publish to `development`, verify Delivery returns it only with
   `X-Seam-Channel: development` and 404s on production.
3. Promote to production via `/publications/promote`, verify production serves.
4. Create a read API key, confirm it can deliver but gets 403 on management.
5. $ARGUMENTS (additional flows to test, if specified)

Always clean up: kill the scratch server, `docker rm -f seam-test-pg`.
Report each step's status; on failure show the response body.
