CREATE TABLE `broker_configs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `broker_oauth` (
	`user_id` text PRIMARY KEY NOT NULL,
	`state_hash` text NOT NULL,
	`verifier` text NOT NULL,
	`client_id` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `broker_tokens` (
	`user_id` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mt5_bridges` (
	`user_id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`account_key` text,
	`snapshot` text,
	`last_seen` integer,
	`enabled` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mt5_bridges_token_hash_unique` ON `mt5_bridges` (`token_hash`);