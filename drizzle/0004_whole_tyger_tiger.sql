CREATE TABLE `feed_health` (
	`provider` text PRIMARY KEY NOT NULL,
	`retry_at` integer NOT NULL,
	`message` text NOT NULL,
	`updated_at` integer NOT NULL
);
