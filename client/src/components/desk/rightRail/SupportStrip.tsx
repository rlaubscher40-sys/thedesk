/**
 * Four-up support strip pinned to the bottom of the Today page. Replaces
 * the old right rail — which was forcing the main feed to share width
 * with metadata that doesn't deserve a full vertical column.
 *
 * Composition: Topics · Reading Queue · Latest Edition · Subscribe.
 * Each cell is its own card, but they share a single bordered band so
 * the row reads as one editorial moment.
 */
import { LatestEdition } from "./LatestEdition";
import { ReadingQueueRail } from "./ReadingQueueRail";
import { Subscribe } from "./Subscribe";
import { TodaysTopics } from "./TodaysTopics";

export function SupportStrip() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      <TodaysTopics />
      <ReadingQueueRail />
      <LatestEdition />
      <Subscribe />
    </section>
  );
}
