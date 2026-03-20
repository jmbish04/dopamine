import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rewards = sqliteTable("rewards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  cost: integer("cost").notNull(),
  icon: text("icon").notNull(),
  tone: text("tone").notNull(),
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const userProfile = sqliteTable("user_profile", {
  id: text("id").primaryKey(),
  xp: integer("xp").notNull().default(0),
});
