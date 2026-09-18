export const ARCHIVE_REGIONS = ["AU", "INTERNATIONAL", "ALL"] as const;
export type ArchiveRegion = (typeof ARCHIVE_REGIONS)[number];
export type ArchiveFilters = { region?: ArchiveRegion; since?: string };

export function matchesArchiveFilters(
  item: { channel?: string | null; feedDate: string },
  filters: ArchiveFilters
): boolean {
  const channel = item.channel ?? "AU";
  if (channel === "HOLD" || (filters.since && item.feedDate < filters.since)) return false;
  const local = channel === "AU" || channel === "PROPERTY";
  return filters.region === "AU" ? local : filters.region === "INTERNATIONAL" ? !local : true;
}
import { z } from "zod";

export const archiveCursorSchema = z.object({
  feedDate: z.iso.date(),
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type ArchiveCursor = z.infer<typeof archiveCursorSchema>;
export const ARCHIVE_PAGE_SIZE = 40;
