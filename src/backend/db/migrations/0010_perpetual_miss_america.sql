CREATE TABLE `health_scan_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`passed` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`durationMs` integer,
	`startedAt` integer NOT NULL,
	`completedAt` integer
);
--> statement-breakpoint
ALTER TABLE `health_test_results` ADD `jobId` text;--> statement-breakpoint
ALTER TABLE `health_test_results` ADD `group` text;