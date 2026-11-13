CREATE TABLE `signal_results` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`signal` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`cursor` integer NOT NULL,
	`result` text NOT NULL
);
