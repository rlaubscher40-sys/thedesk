/** Match explicit dates in questions while excluding postcode numbers.
 * Each selector is an ISO date/month/year prefix; absent dates mean latest stored.
 * This deliberately does not guess relative dates such as "last winter".
 */
export function requestedLocalPeriods(question: string): string[] {
  const periods: string[] = [];
  let remaining = question.replace(/\bpostcode\s+\d{4}\b/gi, " ");
  remaining = remaining.replace(/\b20\d{2}-\d{2}(?:-\d{2})?\b/g, (date) => {
    periods.push(date);
    return " ";
  });
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  remaining = remaining.replace(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(?:quarter\s+)?(20\d{2})\b/gi,
    (_match, month: string, year: string) => {
      periods.push(
        `${year}-${String(months.indexOf(month.slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}`,
      );
      return " ";
    },
  );
  remaining = remaining.replace(
    /\bQ([1-4])\s+(20\d{2})\b/gi,
    (_match, quarter: string, year: string) => {
      periods.push(`${year}-${String(Number(quarter) * 3).padStart(2, "0")}`);
      return " ";
    },
  );
  periods.push(...(remaining.match(/\b20\d{2}\b/g) ?? []));
  return [...new Set(periods)];
}
