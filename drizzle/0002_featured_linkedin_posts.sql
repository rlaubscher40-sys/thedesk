CREATE TABLE `featured_linkedin_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postUrl` varchar(1024) NOT NULL,
	`excerpt` text NOT NULL,
	`authorName` varchar(128) NOT NULL DEFAULT 'Ruben Laubscher',
	`displayOrder` int NOT NULL DEFAULT 100,
	`isLive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `featured_linkedin_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `featured_linkedin_posts_displayOrder_idx` ON `featured_linkedin_posts` (`displayOrder`);
