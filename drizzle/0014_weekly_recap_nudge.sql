ALTER TABLE subscribers ADD lastWeeklyRecapDate varchar(10);
ALTER TABLE reading_queue ADD nudgeSentAt TIMESTAMP NULL;
ALTER TABLE reading_queue ADD nudgeResponse varchar(16) NULL;
