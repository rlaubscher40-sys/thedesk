/**
 * Re-export of the shared headline helpers so client imports can stay on the
 * `@/lib/...` path. Canonical implementation lives in shared/headline.ts and
 * is reused by the ingest pipeline.
 */
export { cleanHeadline, isRedundantSummary } from "@shared/headline";
