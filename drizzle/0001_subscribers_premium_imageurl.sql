CREATE TABLE `subscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(128),
	`confirmToken` varchar(64),
	`confirmedAt` timestamp,
	`unsubscribedAt` timestamp,
	`source` varchar(64),
	`isPremium` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscribers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `isPremium` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `daily_feed_items` ADD `imageUrl` text;
--> statement-breakpoint
CREATE INDEX `subscribers_confirmedAt_idx` ON `subscribers` (`confirmedAt`);
