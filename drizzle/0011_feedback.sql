CREATE TABLE `feedback_submissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `kind` varchar(16) NOT NULL,
  `message` text NOT NULL,
  `pageUrl` varchar(512),
  `userAgent` varchar(512),
  `contactEmail` varchar(320),
  `reporterLabel` varchar(128),
  `status` varchar(16) NOT NULL DEFAULT 'new',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `feedback_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_status_created` ON `feedback_submissions` (`status`, `createdAt`);
