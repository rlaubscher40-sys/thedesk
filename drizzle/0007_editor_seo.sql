ALTER TABLE `editions` ADD `metaTitle` varchar(160);
--> statement-breakpoint
ALTER TABLE `editions` ADD `metaDescription` varchar(320);
--> statement-breakpoint
ALTER TABLE `editions` ADD `socialTitle` varchar(200);
--> statement-breakpoint
ALTER TABLE `editions` ADD `socialDescription` varchar(400);
--> statement-breakpoint
ALTER TABLE `editions` ADD `headlineVariants` json;
