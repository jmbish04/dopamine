---
description: run the core health execution pipeline across both registry items and database definitions
---

1. `curl -X POST http://localhost:8787/api/health/run` to trigger the tests.
2. `curl -X GET http://localhost:8787/api/health/history` to review execution histories.
3. If failures exist:
   - Summarize failed tests.
   - Summarize AI remediation suggestions from the payload.
4. If success:
   - Output: "All Systems Nominal"
