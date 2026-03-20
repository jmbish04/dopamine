/**
 * AI Provider Fallback Logging & Context Management
 * 
 * This module coordinates the behavior when a primary AI provider fails 
 * and a fallback is triggered. It ensures the event is recorded in 
 * persistent logs and flagged in the response metadata.
 * 
 * @module AI/Fallback
 */
import { FallbackAlert } from "@/backend/ai/providers";
import { drizzle } from "drizzle-orm/d1";
import { systemLogs } from "@db/schemas/system_logs";
import { Context } from "hono";

/**
 * Creates an `onFallback` handler for the AI subsystem.
 * 
 * Responsibilities:
 * 1. Attaches the `fallbackAlert` to the Hono context for API payload inclusion.
 * 2. Asynchronously logs the fallback event to D1 `requestLogs`.
 * 
 * @param c - The Hono Context for the current request.
 * @returns A handler function that accepts a `FallbackAlert`.
 * @agent-note Use this in route handlers to ensure visibility of automatic provider transitions.
 */
export function createFallbackHandler(c: Context<any>) {
  return (alert: FallbackAlert) => {
    // 1. Set flag in Hono context
    c.set("fallbackAlert", alert);

    // 2. Fire-and-forget D1 log
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const db = drizzle(c.env.DB);
          await db.insert(systemLogs).values({
            createdAt: Math.floor(Date.now() / 1000),
            level: "WARN",
            message: `[AI_FALLBACK] Provider fallback triggered : ${JSON.stringify(alert)}`,
            method: "APP_LAYER",
            path: new URL(c.req.url).pathname,
            requestId: c.get("requestId") || crypto.randomUUID(),
            module: "ai/fallback",
            event: "ai_fallback",
            file: "fallbackLogger.ts",
            func: "createFallbackHandler",
            line: 0,
            data: JSON.stringify({
              type: "ai_fallback",
              ...alert
            })
          });
        } catch (e) {
          console.error("Failed to write AI fallback D1 log", e);
        }
      })()
    );
  };
}
