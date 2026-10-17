CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`key_cipher` text NOT NULL,
	`key_hint` text DEFAULT '' NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'untested' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`tested_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `provider` text DEFAULT '' NOT NULL;