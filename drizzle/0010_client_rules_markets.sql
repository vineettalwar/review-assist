ALTER TABLE `brand` ADD `rules` text DEFAULT '{"draft":[],"team":[]}' NOT NULL;--> statement-breakpoint
ALTER TABLE `brand` ADD `strict` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `highlights` ADD `label_de` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `highlights` ADD `kind` text DEFAULT 'point' NOT NULL;--> statement-breakpoint
ALTER TABLE `portals` ADD `min_chars` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `market` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `priority` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `track_status` text DEFAULT 'submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `published_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `screenshot_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `track_notes` text DEFAULT '' NOT NULL;