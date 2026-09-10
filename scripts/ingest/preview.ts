/** Read-only live selection preview: no database, model calls or publication. */
import { buildDailyBrief } from "./lib/editorialPipeline";
const { items, report } = await buildDailyBrief();
console.log(
  JSON.stringify(
    {
      report,
      stories: items.map(({ title, url, channel, category, score, sourceTiming }) => ({
        title,
        url,
        channel,
        category,
        score,
        sourceTiming,
      })),
    },
    null,
    2
  )
);
