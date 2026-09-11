ALTER TABLE instagram_posts ADD metricsAttemptedAt TIMESTAMP NULL;
--> statement-breakpoint
ALTER TABLE instagram_posts ADD metricsStatus VARCHAR(16) NULL;
--> statement-breakpoint
ALTER TABLE instagram_posts ADD metricsError VARCHAR(32) NULL;
