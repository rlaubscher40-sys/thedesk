CREATE TABLE `daily_metric_history` (
  `id` int AUTO_INCREMENT NOT NULL,
  `metricKey` varchar(64) NOT NULL,
  `numericValue` double NOT NULL,
  `recordedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `daily_metric_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_metric_history_key_recorded` ON `daily_metric_history` (`metricKey`, `recordedAt`);
