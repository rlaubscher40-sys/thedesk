const HISTORY_KEY = "thedesk:ask-history";
const MAX_HISTORY = 5;

function cleanHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 240))
    .filter((item) => item.length >= 3))].slice(0, MAX_HISTORY);
}

export function readAskHistory(): string[] {
  try {
    return cleanHistory(JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

/** History is optional: blocked/full storage must never stop a question. */
export function rememberAskQuestion(question: string, previous: string[] = []): string[] {
  const next = cleanHistory([question, ...previous, ...readAskHistory()]);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Keep recent questions in component memory for this visit instead.
  }
  return next;
}
