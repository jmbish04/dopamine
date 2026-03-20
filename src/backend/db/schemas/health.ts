import { sqliteTable, text, integer, int } from "drizzle-orm/sqlite-core";

export const healthTestDefinitions = sqliteTable("health_test_definitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  target: text("target").notNull(),
  method: text("method").notNull(),
  expectedStatus: int("expectedStatus").notNull(),
  frequencySeconds: int("frequencySeconds").notNull(),
  criticality: text("criticality").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).notNull()
});

export const healthTestResults = sqliteTable("health_test_results", {
  id: text("id").primaryKey(),
  jobId: text("jobId"),                          // groups results per run
  definitionId: text("definitionId"),
  name: text("name"),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  statusCode: int("statusCode"),
  latencyMs: int("latencyMs").notNull(),
  error: text("error"),
  aiSuggestion: text("aiSuggestion"),
  group: text("group"),                          // module grouping for UI
  createdAt: int("createdAt", { mode: "timestamp" }).notNull()
});

export const healthScanJobs = sqliteTable("health_scan_jobs", {
  id: text("id").primaryKey(),
  trigger: text("trigger").notNull(),            // 'cron' | 'on_demand'
  status: text("status").notNull(),              // 'running' | 'done' | 'failed'
  passed: int("passed").notNull().default(0),
  failed: int("failed").notNull().default(0),
  total: int("total").notNull().default(0),
  durationMs: int("durationMs"),
  startedAt: int("startedAt", { mode: "timestamp" }).notNull(),
  completedAt: int("completedAt", { mode: "timestamp" }),
});

export const healthIncidents = sqliteTable("health_incidents", {
  id: text("id").primaryKey(),
  definitionIdOrName: text("definitionIdOrName").notNull(),
  openedAt: int("openedAt", { mode: "timestamp" }).notNull(),
  resolvedAt: int("resolvedAt", { mode: "timestamp" }),
  lastError: text("lastError"),
  count: int("count").notNull(),
  active: integer("active", { mode: "boolean" }).notNull()
});

