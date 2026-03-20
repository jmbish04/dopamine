CREATE TABLE `tag_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_definitions_name_unique` ON `tag_definitions` (`name`);--> statement-breakpoint
CREATE TABLE `task_tags_map` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `original_content` text;