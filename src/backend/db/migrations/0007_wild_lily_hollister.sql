CREATE TABLE `hero_images` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`prompt` text NOT NULL,
	`greeting` text NOT NULL,
	`rating` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
