import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const heroImages = sqliteTable("hero_images", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  prompt: text("prompt").notNull(),
  greeting: text("greeting").notNull(),
  imageType: text("image_type", { enum: ["morning", "early afternoon", "early evening", "late evening"] }).notNull().default("morning"),
  cfImageId: text("cf_image_id"),
  rating: text("rating", { enum: ["up", "down"] }), // null represents no rating yet
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000))
});
