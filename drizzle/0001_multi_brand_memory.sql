CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`product_id` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`source` text DEFAULT 'admin' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`link_id` text NOT NULL,
	`product_id` text NOT NULL,
	`portal_id` text NOT NULL,
	`rating` integer NOT NULL,
	`draft_text` text DEFAULT '' NOT NULL,
	`final_text` text NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	`learned_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reward` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'code' NOT NULL,
	`value` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_reward`("id", "enabled", "title", "description", "kind", "value") SELECT "id", "enabled", "title", "description", "kind", "value" FROM `reward`;--> statement-breakpoint
DROP TABLE `reward`;--> statement-breakpoint
ALTER TABLE `__new_reward` RENAME TO `reward`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `brand` ADD `website` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `brand` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `examples` ADD `brand_id` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `links` ADD `brand_id` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `portals` ADD `brand_id` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `brand_id` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `url` text DEFAULT '' NOT NULL;