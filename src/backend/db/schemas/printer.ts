import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const printJobs = sqliteTable("print_jobs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["pending", "printed"] }).notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
});
