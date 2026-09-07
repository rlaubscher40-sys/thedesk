/** Never persist place names or query content as analytics dimensions. */
export function analyticsPath(raw: string): string {
  const path = raw.split(/[?#]/, 1)[0]?.slice(0, 256) || "/";
  return path.startsWith("/markets/") ? "/markets/:market" : path;
}
