# Health Governance Protocol

**Activation:** Always On

1.  **Definition of Done:** No feature is complete without a corresponding Health Check.
2.  **Comprehensive Validation:** Checks must verify _functionality_, not just existence.
    - ❌ Bad: "Is Token Null?"
    - ✅ Good: "Validate Token with Provider & Check Scopes".
3.  **Self-Correction:** If you modify a schema or route, you MUST update the corresponding `HealthTestDefinition` or code check immediately.
4.  **Registry:** All new checks must be registered in `backend/src/health/registry.ts` or added as a seed in `backend/prisma/seed.ts`.
