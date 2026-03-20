import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reflections = sqliteTable("reflections", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  answer: text("answer"),
  createdAt: integer("created_at").notNull(),
  answeredAt: integer("answered_at"),
});
