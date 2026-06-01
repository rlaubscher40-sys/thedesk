ALTER TABLE `daily_feed_items` ADD `counterpoint` text;
--> statement-breakpoint
ALTER TABLE `daily_feed_items` ADD `corroborationCount` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `daily_feed_items` ADD `corroboratingSources` json;
