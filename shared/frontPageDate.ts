/** Explicit archive dates are exact. The front page follows its lane's latest filing. */
export function frontPageDate(
  today: string,
  requested: string | null,
  available: string[]
): string {
  if (requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)) return requested;
  return (
    available
      .filter((date) => date <= today)
      .sort()
      .at(-1) ?? today
  );
}
