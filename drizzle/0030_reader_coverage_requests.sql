ALTER TABLE `feedback_submissions` ADD `topic` varchar(32);--> statement-breakpoint
ALTER TABLE `feedback_submissions` ADD `geography` varchar(32);--> statement-breakpoint
ALTER TABLE `feedback_submissions` ADD `readerTask` varchar(16);--> statement-breakpoint
ALTER TABLE `feedback_submissions` ADD `answerUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `feedback_submissions` ADD `answeredAt` timestamp NULL;
