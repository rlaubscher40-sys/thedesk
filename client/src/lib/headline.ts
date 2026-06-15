/**
 * Re-export of the shared headline helpers so client imports can stay on the
 * `@/lib/...` path. Canonical implementation lives in shared/headline.ts and
 * is reused by the ingest pipeline.
 *
 * `cleanHeadline` is wrapped here so every client-rendered title also runs
 * through `dedash` — keeping em-dashes out of headlines without touching the
 * shared/ingest implementation.
 */
import { cleanHeadline as baseCleanHeadline } from "@shared/headline";
import { dedash } from "./dedash";

export function cleanHeadline(title: string): string {
  return dedash(baseCleanHeadline(title));
}

export {
  isRedundantSummary,
  looksLikeGarbage,
  shouldShowSummary,
} from "@shared/headline";
