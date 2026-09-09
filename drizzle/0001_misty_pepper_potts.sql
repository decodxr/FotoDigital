CREATE TABLE `storeMedia` (
	`id` text PRIMARY KEY NOT NULL,
	`objectKey` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `banners` ADD `sortOrder` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `banners` ADD `illustrative` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `banners_active_order_idx` ON `banners` (`active`,`sortOrder`);