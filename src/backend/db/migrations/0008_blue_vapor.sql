PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_hero_images` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`prompt` text NOT NULL,
	`greeting` text NOT NULL,
	`rating` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_hero_images`("id", "url", "prompt", "greeting", "rating", "created_at") SELECT "id", "url", "prompt", "greeting", "rating", "created_at" FROM `hero_images`;--> statement-breakpoint
DROP TABLE `hero_images`;--> statement-breakpoint
ALTER TABLE `__new_hero_images` RENAME TO `hero_images`;--> statement-breakpoint
PRAGMA foreign_keys=ON;