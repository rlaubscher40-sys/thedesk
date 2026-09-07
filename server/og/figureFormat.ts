/**
 * Reading a displayed figure back apart, and writing new ones in its shape.
 *
 * The stat pick hands down one already-formatted string — "4.3%", "$815,439",
 * "12,480" — and several things downstream need to print *different* numbers
 * that look like they belong to it: the ticks of the count-up on the way to it,
 * and the supporting figures beside it (its range over the year, its average).
 *
 * Re-deriving that formatting from the metric key would mean a second place
 * that decides how a percentage is written, and two places that decide are two
 * places that disagree. Instead the shape is read off the figure that was
 * already chosen, so a supporting number is written the way the headline number
 * was written, whatever that turns out to be.
 */

export type FigureShape = {
  prefix: string;
  suffix: string;
  decimals: number;
  grouped: boolean;
  value: number;
};

/** Pull the number out of a display string, and remember how it was dressed.
 *  Returns null when there is no number in it to find. */
export function parseFigure(display: string): FigureShape | null {
  const match = display.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const raw = match[0];
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  return {
    prefix: display.slice(0, match.index ?? 0),
    suffix: display.slice((match.index ?? 0) + raw.length),
    decimals: raw.split(".")[1]?.length ?? 0,
    grouped: raw.includes(","),
    value,
  };
}

/** Write `n` the way the figure this shape came from was written. */
export function formatLike(shape: FigureShape, n: number): string {
  const fixed = Math.abs(n).toFixed(shape.decimals);
  const [whole, frac] = fixed.split(".");
  const body = shape.grouped ? Number(whole).toLocaleString("en-AU") : (whole ?? "0");
  const sign = n < 0 ? "-" : "";
  return `${shape.prefix}${sign}${body}${frac ? `.${frac}` : ""}${shape.suffix}`;
}
