CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`data` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `addresses_user` ON `addresses` (`userId`);--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`action` text NOT NULL,
	`entityId` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created` ON `auditLogs` (`createdAt`);--> statement-breakpoint
CREATE TABLE `banners` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`image` text NOT NULL,
	`link` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cartItems` (
	`id` text PRIMARY KEY NOT NULL,
	`cartId` text NOT NULL,
	`productId` text NOT NULL,
	`quantity` integer NOT NULL,
	`variantId` text,
	`fields` text DEFAULT '{}' NOT NULL,
	`photos` text DEFAULT '[]' NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`cartId`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cartItems_cart` ON `cartItems` (`cartId`);--> statement-breakpoint
CREATE TABLE `carts` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`ownerKey` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `carts_owner` ON `carts` (`ownerKey`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`image` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `couponInventory` (
	`id` text PRIMARY KEY NOT NULL,
	`available` integer NOT NULL,
	CONSTRAINT "couponInventory_nonnegative" CHECK("couponInventory"."available" >= 0)
);
--> statement-breakpoint
CREATE TABLE `couponUses` (
	`id` text PRIMARY KEY NOT NULL,
	`couponId` text NOT NULL,
	`userId` text NOT NULL,
	`orderId` text NOT NULL,
	`ordinal` integer NOT NULL,
	FOREIGN KEY (`couponId`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `couponUses_unique` ON `couponUses` (`couponId`,`userId`,`ordinal`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` integer NOT NULL,
	`minAmount` integer DEFAULT 0 NOT NULL,
	`expiresAt` text,
	`categories` text DEFAULT '[]' NOT NULL,
	`maxUses` integer,
	`used` integer DEFAULT 0 NOT NULL,
	`perCustomer` integer DEFAULT 1 NOT NULL,
	`firstPurchase` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`productId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_product` ON `favorites` (`userId`,`productId`);--> statement-breakpoint
CREATE TABLE `firstPurchaseClaims` (
	`id` text PRIMARY KEY NOT NULL,
	`orderId` text NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`message` text NOT NULL,
	`photoId` text,
	`status` text DEFAULT 'received' NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photoId`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`available` integer NOT NULL,
	CONSTRAINT "inventory_nonnegative" CHECK("inventory"."available" >= 0)
);
--> statement-breakpoint
CREATE TABLE `orderEvents` (
	`id` text PRIMARY KEY NOT NULL,
	`orderId` text NOT NULL,
	`status` text NOT NULL,
	`note` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_order` ON `orderEvents` (`orderId`);--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` text PRIMARY KEY NOT NULL,
	`orderId` text NOT NULL,
	`productId` text NOT NULL,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orderItems_order` ON `orderItems` (`orderId`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`userId` text NOT NULL,
	`idempotencyKey` text NOT NULL,
	`status` text NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer NOT NULL,
	`shipping` integer NOT NULL,
	`total` integer NOT NULL,
	`delivery` text NOT NULL,
	`address` text NOT NULL,
	`customer` text NOT NULL,
	`paymentMethod` text NOT NULL,
	`paymentStatus` text NOT NULL,
	`paymentUrl` text,
	`pixCode` text,
	`tracking` text,
	`internalNote` text DEFAULT '' NOT NULL,
	`couponId` text,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`couponId`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number` ON `orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency` ON `orders` (`userId`,`idempotencyKey`);--> statement-breakpoint
CREATE INDEX `orders_user_created` ON `orders` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`orderId` text NOT NULL,
	`provider` text NOT NULL,
	`externalId` text,
	`status` text NOT NULL,
	`amount` integer NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_external` ON `payments` (`externalId`);--> statement-breakpoint
CREATE INDEX `payments_order` ON `payments` (`orderId`);--> statement-breakpoint
CREATE TABLE `photoConfigurations` (
	`id` text PRIMARY KEY NOT NULL,
	`orderItemId` text NOT NULL,
	`photoId` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`orderItemId`) REFERENCES `orderItems`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photoId`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `photoConfigurations_orderItem` ON `photoConfigurations` (`orderItemId`);--> statement-breakpoint
CREATE INDEX `photoConfigurations_photo` ON `photoConfigurations` (`photoId`);--> statement-breakpoint
CREATE TABLE `printSizes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`width` real NOT NULL,
	`height` real NOT NULL,
	`price` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`finishes` text DEFAULT '["Brilhante","Fosco"]' NOT NULL,
	`tiers` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`categoryId` text NOT NULL,
	`kind` text NOT NULL,
	`image` text NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`price` integer,
	`salePrice` integer,
	`stock` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`fields` text DEFAULT '[]' NOT NULL,
	`variants` text DEFAULT '[]' NOT NULL,
	`productionDays` integer DEFAULT 0 NOT NULL,
	`weight` integer,
	`width` real,
	`height` real,
	`length` real,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_category_active` ON `products` (`categoryId`,`active`);--> statement-breakpoint
CREATE TABLE `rateLimits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`resetAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`image` text NOT NULL,
	`gallery` text DEFAULT '[]' NOT NULL,
	`faq` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_slug` ON `services` (`slug`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expiresAt` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`userId`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerKey` text NOT NULL,
	`orderId` text,
	`cep` text NOT NULL,
	`cartDigest` text NOT NULL,
	`data` text NOT NULL,
	`expiresAt` text NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shipments_owner` ON `shipments` (`ownerKey`);--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerKey` text NOT NULL,
	`userId` text,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	`pageCount` integer DEFAULT 1 NOT NULL,
	`objectKey` text NOT NULL,
	`thumbnailKey` text,
	`status` text NOT NULL,
	`expiresAt` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `uploads_owner` ON `uploads` (`ownerKey`);--> statement-breakpoint
CREATE INDEX `uploads_expiry` ON `uploads` (`expiresAt`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`passwordHash` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`taxId` text DEFAULT '' NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email` ON `users` (`email`);