ALTER TABLE `editions` ADD `marketStress` varchar(16);
--> statement-breakpoint
ALTER TABLE `editions` ADD `datesToWatch` json;
--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `context` varchar(256);
--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `groupKey` varchar(32);
