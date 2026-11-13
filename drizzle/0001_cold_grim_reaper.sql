CREATE TABLE `alert_config` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alert_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alert_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`result` text NOT NULL
);
