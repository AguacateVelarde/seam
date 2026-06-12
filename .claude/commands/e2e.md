---
description: Spin up a scratch DB and smoke-test the server API end-to-end
---

Stand up a disposable Postgres and run the scripted API integration suite
(unit tests don't cover routes; this does — auth, channels, promote,
experiments, adapters, invites, rollback):

```sh
docker run --rm -d --name seam-test-pg -p 5434:5432 \
  -e POSTGRES_USER=seam -e POSTGRES_PASSWORD=seam -e POSTGRES_DB=seam postgres:16-alpine
sleep 3
DATABASE_URL=postgres://seam:seam@localhost:5434/seam bun run --cwd apps/server e2e
docker rm -f seam-test-pg
```

If $ARGUMENTS names additional flows to verify, test those with curl against
the same scratch server before cleanup (see apps/server/scripts/e2e.ts for the
request helper patterns). On failure, show the failing assertion and response
body, fix the root cause, and re-run.
