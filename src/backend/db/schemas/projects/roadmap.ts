import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at").notNull(),
});

export const roadmapStatuses = ["todo", "in_progress", "done"] as const;

export const roadmapItems = sqliteTable("roadmap_items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: roadmapStatuses }).notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  assignedAgent: text("assigned_agent"),
  dueAt: integer("due_at"),
  createdAt: integer("created_at").notNull(),
});
