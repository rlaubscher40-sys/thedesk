CREATE TABLE `instagram_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mediaId` varchar(64) NOT NULL,
	`postType` varchar(16) NOT NULL,
	`feedDate` varchar(10),
	`editionNumber` int,
	`headline` varchar(512),
	`likes` int,
	`comments` int,
	`reach` int,
	`saved` int,
	`shares` int,
	`totalInteractions` int,
	`metricsFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `instagram_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `instagram_posts_mediaId_unique` UNIQUE(`mediaId`)
);
