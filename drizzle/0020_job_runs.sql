CREATE TABLE `job_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobKey` varchar(64) NOT NULL,
	`runDate` varchar(10) NOT NULL,
	`status` varchar(16) NOT NULL,
	`attempts` int NOT NULL DEFAULT 1,
	`detail` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `job_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_job_runs_key_date` UNIQUE(`jobKey`,`runDate`)
);
