import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const aiCostLogs = sqliteTable("ai_cost_logs", {
  id: text("id").primaryKey(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  estimatedCost: integer("estimated_cost").notNull(), // in micros
  sessionId: text("session_id"),
  documentId: text("document_id"),
  workflowName: text("workflow_name"),
  timestamp: integer("timestamp").notNull().$defaultFn(() => Date.now()),
});

export const budgetEvents = sqliteTable("budget_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  threshold: integer("threshold").notNull().default(0),
  currentSpend: integer("current_spend").notNull().default(0),
  timestamp: integer("timestamp").notNull().$defaultFn(() => Date.now()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  isIgnore: integer("is_ignore").notNull().default(0), // 0 or 1
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
});
