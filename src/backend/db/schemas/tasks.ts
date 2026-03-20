import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const taskStatuses = ["open", "in_progress", "paused", "done"] as const;
export const taskPrintStatuses = ["queued", "sent", "failed"] as const;

export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPrintStatus = (typeof taskPrintStatuses)[number];

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes"),
  status: text("status", { enum: taskStatuses }).notNull().default("open"),
  layer: integer("layer").notNull().default(1),
  xp: integer("xp").notNull().default(25),
  receiptQrValue: text("receipt_qr_value").notNull(),
  printStatus: text("print_status", { enum: taskPrintStatuses })
    .notNull()
    .default("queued"),
  timeSpent: integer("time_spent").notNull().default(0),
  lastStartedAt: integer("last_started_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  completedAt: integer("completed_at"),
  dueDate: integer("due_date"),
  position: integer("position").notNull().default(0),
  originalContent: text("original_content"),
});
