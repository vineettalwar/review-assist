CREATE TABLE `brand` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`about` text DEFAULT '' NOT NULL,
	`voice` text DEFAULT 'warm' NOT NULL,
	`voice_notes` text DEFAULT '' NOT NULL,
	`words_to_avoid` text DEFAULT '' NOT NULL,
	`default_language` text DEFAULT 'en' NOT NULL,
	`logo_key` text,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`portal_id` text NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`rating` integer NOT NULL,
	`highlight_keys` text DEFAULT '[]' NOT NULL,
	`length` text NOT NULL,
	`variant` integer DEFAULT 0 NOT NULL,
	`text` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_cache_key` ON `drafts` (`link_id`,`rating`,`highlight_keys`,`length`,`variant`);--> statement-breakpoint
CREATE TABLE `examples` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`rating` integer NOT NULL,
	`text` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`label` text NOT NULL,
	`polarity` text DEFAULT 'pos' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`product_id` text NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`visit_notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`portal_id` text,
	`created_at` integer NOT NULL,
	`opened_at` integer,
	`copied_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_token_unique` ON `links` (`token`);--> statement-breakpoint
CREATE TABLE `portals` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`allows_incentives` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_portals` (
	`product_id` text NOT NULL,
	`portal_id` text NOT NULL,
	PRIMARY KEY(`product_id`, `portal_id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`knowledge` text DEFAULT '' NOT NULL,
	`avoid` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reward` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'code' NOT NULL,
	`value` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`model` text DEFAULT 'openai/gpt-4o-mini' NOT NULL,
	`temperature` real DEFAULT 0.7 NOT NULL,
	`max_tokens` integer DEFAULT 400 NOT NULL,
	`system_prompt_extra` text DEFAULT '' NOT NULL
);
