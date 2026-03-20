import type { CodeHealthCheck } from "../registry";

/**
 * Honidev agent DO reachability checks.
 * Sends a minimal POST to each agent's /history endpoint (lightweight, no inference).
 */
export const AGENT_CHECKS: CodeHealthCheck[] = [
  {
    id: "planner_agent_do",
    name: "PlannerAgent Durable Object",
    group: "AI Agents",
    check: async (env: Env) => {
      try {
        if (!env.PLANNER) return { ok: false, message: "PLANNER binding missing." };
        const id = env.PLANNER.idFromName("health-probe");
        const stub = env.PLANNER.get(id);
        const res = await stub.fetch(new Request("http://internal/history", { method: "GET" }));
        return { ok: res.ok, message: res.ok ? "PlannerAgent DO reachable." : `DO returned ${res.status}.` };
      } catch (e: any) {
        return { ok: false, message: `PlannerAgent error: ${e.message}` };
      }
    },
  },
  {
    id: "supervisor_do",
    name: "Supervisor Durable Object",
    group: "AI Agents",
    check: async (env: Env) => {
      try {
        if (!env.SUPERVISOR) return { ok: false, message: "SUPERVISOR binding missing." };
        const id = env.SUPERVISOR.idFromName("health-probe");
        const stub = env.SUPERVISOR.get(id);
        const res = await stub.fetch(new Request("http://internal/status", { method: "GET" }));
        return { ok: res.ok, message: res.ok ? "Supervisor DO reachable." : `DO returned ${res.status}.` };
      } catch (e: any) {
        return { ok: false, message: `Supervisor error: ${e.message}` };
      }
    },
  },
  {
    id: "spotify_agent_do",
    name: "SpotifyAgent Durable Object",
    group: "AI Agents",
    check: async (env: Env) => {
      try {
        if (!env.SPOTIFY_AGENT) return { ok: false, message: "SPOTIFY_AGENT binding missing." };
        const id = env.SPOTIFY_AGENT.idFromName("health-probe");
        const stub = env.SPOTIFY_AGENT.get(id);
        const res = await stub.fetch(new Request("http://internal/history", { method: "GET" }));
        return { ok: res.ok, message: res.ok ? "SpotifyAgent DO reachable." : `DO returned ${res.status}.` };
      } catch (e: any) {
        return { ok: false, message: `SpotifyAgent error: ${e.message}` };
      }
    },
  },
  {
    id: "email_agent_do",
    name: "EmailAgent Durable Object",
    group: "AI Agents",
    check: async (env: Env) => {
      try {
        const e = env as any;
        if (!e.EMAIL_AGENT) return { ok: false, message: "EMAIL_AGENT binding missing." };
        const id = e.EMAIL_AGENT.idFromName("health-probe");
        const stub = e.EMAIL_AGENT.get(id);
        const res = await stub.fetch(new Request("http://internal/history", { method: "GET" }));
        return { ok: res.ok, message: res.ok ? "EmailAgent DO reachable." : `DO returned ${res.status}.` };
      } catch (e: any) {
        return { ok: false, message: `EmailAgent error: ${e.message}` };
      }
    },
  },
];
