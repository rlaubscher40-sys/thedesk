import { feedbackPageUrl } from "./feedbackPageUrl";

/** Strip URL credentials, queries and fragments from diagnostic text while
 * retaining asset paths and stack locations. This is not a general-purpose
 * personal-data detector: callers must never add request bodies or form values. */
function diagnosticText(value: string, limit: number): string {
  return value
    .slice(0, 32_000)
    .replace(/https?:\/\/[^\s<>"'`)]+/gi, (raw) => {
      try {
        const url = new URL(raw);
        return url.origin + url.pathname;
      } catch {
        return "[invalid URL]";
      }
    })
    .replace(/(^|[\s("'`])(\/{1,2}[^\s<>"'`)]+)/g, (_match, prefix: string, raw: string) => {
      if (raw.startsWith("//")) {
        try {
          const url = new URL("https:" + raw);
          return prefix + "//" + url.host + url.pathname;
        } catch {
          return prefix + "[invalid URL]";
        }
      }
      return prefix + raw.split(/[?#]/, 1)[0];
    })
    .slice(0, limit);
}

/** Shared browser/server boundary: scrub before transmission and again before
 * persistence, and fit the existing API/database limits. */
export function clientErrorReport(input: {
  message: string;
  stack?: string | null;
  url?: string | null;
}) {
  return {
    message: diagnosticText(input.message, 512),
    stack: input.stack ? diagnosticText(input.stack, 8_000) : null,
    url: feedbackPageUrl(input.url) ?? "",
  };
}
