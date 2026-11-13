ALTER TABLE `alert_deliveries` ADD `attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_deliveries` ADD `retry_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_deliveries` ADD `error_code` text;