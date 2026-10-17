CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`brand_id` text NOT NULL,
	`product_id` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`portal_id` text,
	`created_at` integer NOT NULL,
	`copied_at` integer
);
--> statement-breakpoint
CREATE INDEX `visits_brand_recent` ON `visits` (`brand_id`,`created_at`);--> statement-breakpoint
DROP INDEX `drafts_cache_key`;--> statement-breakpoint
ALTER TABLE `drafts` ADD `visit_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `product_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_visit_key` ON `drafts` (`link_id`,`visit_id`,`rating`,`highlight_keys`,`length`,`variant`);--> statement-breakpoint
CREATE INDEX `drafts_product_recent` ON `drafts` (`product_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `brand` ADD `audience` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `brand` ADD `facts` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `highlights` ADD `label_ja` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `highlights_product` ON `highlights` (`product_id`);--> statement-breakpoint
ALTER TABLE `links` ADD `kind` text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
CREATE INDEX `links_product` ON `links` (`product_id`);--> statement-breakpoint
ALTER TABLE `products` ADD `audience` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `experience` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `praise` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `concerns` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `products_brand` ON `products` (`brand_id`);--> statement-breakpoint
ALTER TABLE `settings` ADD `languages` text DEFAULT '["en"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `focus_brand_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `examples_brand` ON `examples` (`brand_id`);--> statement-breakpoint
CREATE INDEX `memories_brand_status` ON `memories` (`brand_id`,`status`);--> statement-breakpoint
CREATE INDEX `portals_brand` ON `portals` (`brand_id`);--> statement-breakpoint
CREATE INDEX `submissions_brand` ON `submissions` (`brand_id`,`edited`);--> statement-breakpoint
UPDATE `drafts` SET `product_id` = (SELECT `product_id` FROM `links` WHERE `links`.`id` = `drafts`.`link_id`) WHERE `product_id` = '';
