CREATE TABLE `github_research_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`results` text NOT NULL,
	`session_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `github_research_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `github_research_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jules_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`task_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jules_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`prompt` text NOT NULL,
	`repo_full_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_cost_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`estimated_cost` integer NOT NULL,
	`session_id` text,
	`document_id` text,
	`workflow_name` text,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budget_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`message` text NOT NULL,
	`threshold` integer DEFAULT 0 NOT NULL,
	`current_spend` integer DEFAULT 0 NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`is_ignore` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`cost` integer NOT NULL,
	`icon` text NOT NULL,
	`tone` text NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`answer` text,
	`created_at` integer NOT NULL,
	`answered_at` integer
);
--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
DROP TABLE `github_research`;--> statement-breakpoint
ALTER TABLE `tasks` ADD `position` integer DEFAULT 0 NOT NULL;