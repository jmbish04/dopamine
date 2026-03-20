import type { CodeHealthCheck } from "../registry";
import { getDb } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Database & storage layer health checks.
 * Tests D1 connectivity, KV round-trip, and Vectorize binding.
 */
export const DB_CHECKS: CodeHealthCheck[] = [
  {
    id: "db_connectivity",
    name: "D1 Database Connectivity",
    group: "Database & Storage",
    check: async (env: Env) => {
      try {
        const db = getDb(env);
        await db.run(sql`SELECT 1`);
        return { ok: true, message: "D1 query succeeded." };
      } catch (e: any) {
        return { ok: false, message: `D1 offline: ${e.message}` };
      }
    },
  },
  {
    id: "kv_roundtrip",
    name: "KV Namespace Read/Write",
    group: "Database & Storage",
    check: async (env: Env) => {
      const key = `__health_probe_${Date.now()}`;
      try {
        await env.KV.put(key, "1", { expirationTtl: 60 });
        const val = await env.KV.get(key);
        await env.KV.delete(key);
        if (val !== "1") return { ok: false, message: "KV round-trip value mismatch." };
        return { ok: true, message: "KV read/write successful." };
      } catch (e: any) {
        return { ok: false, message: `KV error: ${e.message}` };
      }
    },
  },
  {
    id: "vectorize_binding",
    name: "Vectorize Index Binding",
    group: "Database & Storage",
    check: async (env: Env) => {
      try {
        if (!env.VECTORIZE_LOGS) return { ok: false, message: "VECTORIZE_LOGS binding missing." };
        // Lightweight describe — just check binding is callable
        const info = await (env.VECTORIZE_LOGS as any).describe?.();
        return { ok: true, message: `Vectorize bound${info ? ` (${info.name ?? "dopamine-logs"})` : ""}.` };
      } catch (e: any) {
        return { ok: false, message: `Vectorize error: ${e.message}` };
      }
    },
  },
];
