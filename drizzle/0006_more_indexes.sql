CREATE INDEX `claims_link` ON `claims` (`link_id`);--> statement-breakpoint
CREATE INDEX `claims_visit` ON `claims` (`visit_id`);--> statement-breakpoint
CREATE INDEX `links_brand_recent` ON `links` (`brand_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `submissions_link_visit` ON `submissions` (`link_id`,`visit_id`);--> statement-breakpoint
CREATE INDEX `submissions_product_recent` ON `submissions` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `visits_link` ON `visits` (`link_id`);