---
description: Run the full quality gate (build, typecheck, tests, lint) and report
---

Run the full repo quality gate and report results concisely:

1. `bunx turbo build typecheck test --force` — all 17 tasks must pass.
2. `bunx biome check .` — must report zero errors.

If anything fails, show the failing output, fix the root cause (not the
symptom), and re-run until green. Do not skip or xfail tests to get green.
