CREATE TABLE `system_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text,
	`level` text NOT NULL,
	`module` text NOT NULL,
	`event` text NOT NULL,
	`message` text NOT NULL,
	`file` text NOT NULL,
	`func` text NOT NULL,
	`line` integer NOT NULL,
	`method` text,
	`path` text,
	`stack` text,
	`data` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'open' NOT NULL,
	`layer` integer DEFAULT 1 NOT NULL,
	`xp` integer DEFAULT 25 NOT NULL,
	`receipt_qr_value` text NOT NULL,
	`print_status` text DEFAULT 'queued' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `github_repos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`default_branch` text DEFAULT 'main' NOT NULL,
	`language` text,
	`stars` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `github_research` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`results` text NOT NULL,
	`session_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roadmap_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`assigned_agent` text,
	`due_at` integer,
	`created_at` integer NOT NULL
);
