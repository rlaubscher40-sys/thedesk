-- Read-only checks for the explicitly selected isolated TiDB recovery instance.
-- Confirm instance identity in the console first. Run statements individually.
-- Do not boot the app, reconnect senders, reset locks or retrieve subscriber PII.

SELECT COUNT(*) AS table_count
FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'thedesk';

-- Drift indicators only: CRC32/XOR is not a cryptographic integrity proof.
SELECT 'columns' AS kind, COUNT(*) AS entries,
  BIT_XOR(CRC32(CONCAT_WS('|', TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION,
    COLUMN_TYPE, IS_NULLABLE, COALESCE(COLUMN_DEFAULT, '<NULL>'), EXTRA))) AS signature
FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'thedesk'
UNION ALL
SELECT 'indexes', COUNT(*),
  BIT_XOR(CRC32(CONCAT_WS('|', TABLE_NAME, INDEX_NAME, NON_UNIQUE,
    SEQ_IN_INDEX, COLUMN_NAME, COALESCE(SUB_PART, 0))))
FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'thedesk';

SELECT 'stories' AS dataset, COUNT(*) AS rows_found FROM thedesk.daily_feed_items
UNION ALL SELECT 'editions', COUNT(*) FROM thedesk.editions
UNION ALL SELECT 'metrics', COUNT(*) FROM thedesk.daily_metrics
UNION ALL SELECT 'subscribers', COUNT(*) FROM thedesk.subscribers
UNION ALL SELECT 'job_runs', COUNT(*) FROM thedesk.job_runs
UNION ALL SELECT 'publication_controls', COUNT(*) FROM thedesk.publication_controls
UNION ALL SELECT 'consent_events', COUNT(*) FROM thedesk.subscriber_consent_events
UNION ALL SELECT 'instagram_posts', COUNT(*) FROM thedesk.instagram_posts;

SELECT COUNT(*) AS total,
  SUM(confirmedAt IS NOT NULL AND unsubscribedAt IS NULL) AS active_confirmed,
  SUM(unsubscribedAt IS NOT NULL) AS unsubscribed,
  SUM(consentRequestedAt IS NOT NULL) AS recorded_requests,
  SUM(consentNoticeVersion IS NOT NULL) AS notice_versions,
  SUM(confirmedAt IS NOT NULL AND confirmToken IS NOT NULL) AS confirmed_with_pending_token
FROM thedesk.subscribers;

SELECT 'duplicate_job_keys' AS check_name, COUNT(*) AS findings
FROM (SELECT jobKey, runDate FROM thedesk.job_runs
  GROUP BY jobKey, runDate HAVING COUNT(*) > 1) d
UNION ALL SELECT 'duplicate_delivery_keys', COUNT(*)
FROM (SELECT feedDate, subscriberId FROM thedesk.daily_brief_deliveries
  GROUP BY feedDate, subscriberId HAVING COUNT(*) > 1) e
UNION ALL SELECT 'invalid_edition_json', COUNT(*) FROM thedesk.editions
WHERE JSON_VALID(topics) = 0 OR JSON_VALID(signals) = 0
UNION ALL SELECT 'published_media_records', COUNT(*) FROM thedesk.job_runs
WHERE status = 'success' AND detail REGEXP '^Published media [0-9]+$';

SELECT status, COUNT(*) AS rows_found, SUM(payload IS NULL) AS cleared_payloads
FROM thedesk.daily_brief_deliveries GROUP BY status;
