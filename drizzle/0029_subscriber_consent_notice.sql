-- No historical consent is inferred or backfilled.
ALTER TABLE subscribers ADD consentNoticeVersion varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE subscribers ADD consentRequestedAt timestamp NULL;
