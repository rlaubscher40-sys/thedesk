/**
 * POST helper with one retry. Used by both daily-feed and weekly-edition
 * scripts to call the ingest endpoints. Network failures bubble; HTTP error
 * responses are surfaced via Error so GitHub Actions marks the run as red.
 */

export async function postJSON(url: string, body: unknown, apiKey: string): Promise<unknown> {
  const attempt = async (): Promise<Response> => {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scheduled-key": apiKey,
      },
      body: JSON.stringify(body),
    });
  };

  let res: Response;
  try {
    res = await attempt();
  } catch (err) {
    console.warn(`[post] network error, retrying in 4s: ${(err as Error).message}`);
    await new Promise((r) => setTimeout(r, 4_000));
    res = await attempt();
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${url} → ${res.status} ${res.statusText}: ${text.slice(0, 240)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
