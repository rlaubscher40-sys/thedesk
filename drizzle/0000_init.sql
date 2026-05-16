CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `editions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`editionNumber` int NOT NULL,
	`weekOf` varchar(64) NOT NULL,
	`weekRange` varchar(128) NOT NULL,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`pdfUrl` text,
	`readingTime` varchar(32),
	`topics` json NOT NULL,
	`signals` json NOT NULL,
	`fullText` text,
	`keyMetrics` json,
	`heroImageUrl` text,
	`rubensTake` text,
	`substackDraftTitle` text,
	`substackDraftSubtitle` text,
	`substackDraftBody` text,
	`substackDraftImageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `editions_id` PRIMARY KEY(`id`),
	CONSTRAINT `editions_editionNumber_unique` UNIQUE(`editionNumber`)
);
--> statement-breakpoint
CREATE TABLE `daily_feed_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feedDate` varchar(10) NOT NULL,
	`title` varchar(512) NOT NULL,
	`source` varchar(256) NOT NULL,
	`sourceUrl` text,
	`summary` text NOT NULL,
	`category` varchar(64) NOT NULL,
	`partnerTag` text,
	`sayThis` text,
	`promotedToEdition` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_feed_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reading_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`feedItemId` int,
	`customUrl` text,
	`customTitle` varchar(512),
	`articleText` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reading_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`weekId` varchar(16) NOT NULL,
	`content` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weekly_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_tracker` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`editionId` int,
	`lineText` text NOT NULL,
	`usedWithCategory` varchar(128),
	`usedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_tracker_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `daily_feed_items_feedDate_idx` ON `daily_feed_items` (`feedDate`);
--> statement-breakpoint
CREATE INDEX `daily_feed_items_category_idx` ON `daily_feed_items` (`category`);
--> statement-breakpoint
CREATE INDEX `reading_queue_userId_idx` ON `reading_queue` (`userId`);
--> statement-breakpoint
CREATE INDEX `weekly_notes_userId_idx` ON `weekly_notes` (`userId`);
--> statement-breakpoint
CREATE INDEX `conversation_tracker_userId_idx` ON `conversation_tracker` (`userId`);
