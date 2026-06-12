---
description: Rebuild and redeploy the local Docker stack, then verify health
---

Rebuild the Docker images and roll the running local stack:

1. `bunx turbo build typecheck test` first — never deploy red.
2. `docker compose up -d --build server studio`
3. Verify: `curl -s http://localhost:3000/health` returns ok; check
   `docker compose logs server --since 1m` for migration or startup errors;
   confirm Studio serves at :8080 and the served JS bundle hash changed.

The server auto-migrates on start (`SEAM_AUTO_MIGRATE=true`). If a migration
fails, report the error — do not reset the database without explicit approval.
