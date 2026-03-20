import type { CodeHealthCheck } from "../registry";

/**
 * Core API route smoke tests.
 * Makes self-requests through the worker to verify routes are functional.
 */
export const API_CHECKS: CodeHealthCheck[] = [
  {
    id: "api_tasks_list",
    name: "GET /api/tasks",
    group: "API & Database",
    check: async (env: Env) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const workerName = (env as any).WORKER_NAME || "dopamine";
        const res = await fetch(`https://${workerName}.hacolby.workers.dev/api/tasks`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status !== 200) return { ok: false, message: `GET /api/tasks returned ${res.status}.` };
        return { ok: true, message: `GET /api/tasks OK (${res.status}).` };
      } catch (e: any) {
        return { ok: false, message: `API tasks check failed: ${e.message}` };
      }
    },
  },
  {
    id: "api_health_endpoint",
    name: "GET /api/health",
    group: "API & Database",
    check: async (env: Env) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const workerName = (env as any).WORKER_NAME || "dopamine";
        const res = await fetch(`https://${workerName}.hacolby.workers.dev/api/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status !== 200) return { ok: false, message: `GET /api/health returned ${res.status}.` };
        return { ok: true, message: `GET /api/health self-check OK.` };
      } catch (e: any) {
        return { ok: false, message: `Health endpoint check failed: ${e.message}` };
      }
    },
  },
  {
    id: "api_session_hero",
    name: "GET /api/session/hero",
    group: "API & Database",
    check: async (env: Env) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const workerName = (env as any).WORKER_NAME || "dopamine";
        const res = await fetch(`https://${workerName}.hacolby.workers.dev/api/session/hero`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status !== 200) return { ok: false, message: `Session hero returned ${res.status}.` };
        return { ok: true, message: "Session hero endpoint OK." };
      } catch (e: any) {
        return { ok: false, message: `Session hero check failed: ${e.message}` };
      }
    },
  },
];
