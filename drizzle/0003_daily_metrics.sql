CREATE TABLE `daily_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricKey` varchar(64) NOT NULL,
	`label` varchar(128) NOT NULL,
	`value` varchar(64) NOT NULL,
	`unit` varchar(16),
	`previousValue` varchar(64),
	`source` varchar(64),
	`asOf` timestamp NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 100,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_metrics_metricKey_unique` UNIQUE(`metricKey`)
);
