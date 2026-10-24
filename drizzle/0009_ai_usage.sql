CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text,
	`source` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real,
	`cost_source` text,
	`ms` integer DEFAULT 0 NOT NULL,
	`ok` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_created` ON `ai_usage` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_usage_brand` ON `ai_usage` (`brand_id`);