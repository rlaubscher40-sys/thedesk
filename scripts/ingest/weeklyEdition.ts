/**
 * Weekly edition synthesis trigger. Runs once a week (Sunday evening AEDT)
 * on GitHub Actions.
 *
 * All the heavy lifting happens server-side: this script just hits
 * /api/ingest/synthesize-edition, which gathers the week's feed items,
 * runs the synthesis prompt through the Anthropic API, and persists the
 * new edition. We do nothing locally so the script needs zero LLM
 * credentials.
 *
 * Required env:
 *   INGEST_BASE_URL    — the deployed site URL, e.g. https://thedesk.com.au
 *   SCHEDULED_API_KEY  — matches the server's SCHEDULED_API_KEY env var
 */
import { postJSON } from "./lib/post";

async function main(): Promise<void> {
  const baseUrl = process.env.INGEST_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.SCHEDULED_API_KEY;
  if (!baseUrl) throw new Error("INGEST_BASE_URL is required");
  if (!apiKey) throw new Error("SCHEDULED_API_KEY is required");

  const today = new Date().toISOString().slice(0, 10);
  console.log(`[weekly] requesting synthesis for week containing ${today}`);

  const result = await postJSON(
    `${baseUrl}/api/ingest/synthesize-edition`,
    { anyDateInWeek: today },
    apiKey
  );
  console.log(`[weekly] server response:`, result);
  console.log(`[weekly] done.`);
}

main()
  .then(() => {
    // Force exit so dangling keepalive sockets don't hold Node past
    // `done`. Same reasoning as dailyFeed.ts.
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
