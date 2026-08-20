ALTER TABLE `page_views` ADD `country` varchar(2);
--> statement-breakpoint
CREATE INDEX `idx_page_views_country` ON `page_views` (`country`,`viewedAt`);
