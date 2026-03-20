CREATE TABLE `health_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`definitionIdOrName` text NOT NULL,
	`openedAt` integer NOT NULL,
	`resolvedAt` integer,
	`lastError` text,
	`count` integer NOT NULL,
	`active` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `health_test_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target` text NOT NULL,
	`method` text NOT NULL,
	`expectedStatus` integer NOT NULL,
	`frequencySeconds` integer NOT NULL,
	`criticality` text NOT NULL,
	`enabled` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `health_test_definitions_name_unique` ON `health_test_definitions` (`name`);--> statement-breakpoint
CREATE TABLE `health_test_results` (
	`id` text PRIMARY KEY NOT NULL,
	`definitionId` text,
	`name` text,
	`ok` integer NOT NULL,
	`statusCode` integer,
	`latencyMs` integer NOT NULL,
	`error` text,
	`aiSuggestion` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
DROP TABLE `github_repos`;--> statement-breakpoint
DROP TABLE `github_research_briefs`;--> statement-breakpoint
DROP TABLE `github_research_candidates`;--> statement-breakpoint
DROP TABLE `github_research_plans`;--> statement-breakpoint
DROP TABLE `jules_jobs`;--> statement-breakpoint
DROP TABLE `jules_sessions`;