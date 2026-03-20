import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const logLevels = ["INFO", "WARN", "ERROR"] as const;
export type LogLevel = (typeof logLevels)[number];

export const systemLogs = sqliteTable("system_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: text("request_id"),
  level: text("level", { enum: logLevels }).notNull(),
  module: text("module").notNull(),
  event: text("event").notNull(),
  message: text("message").notNull(),
  file: text("file").notNull(),
  func: text("func").notNull(),
  line: integer("line").notNull(),
  method: text("method"),
  path: text("path"),
  stack: text("stack"),
  data: text("data"),
  source: text("source").notNull().default("worker"),
  createdAt: integer("created_at").notNull(),
});
