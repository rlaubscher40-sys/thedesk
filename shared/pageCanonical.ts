import { DEFAULT_SITE_URL } from "./const";

/** Preserve content-identifying share parameters, excluding tracking and UI filters. */
export function pageCanonical(pathname: string, search = "", base = DEFAULT_SITE_URL): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(search);
  const kept: string[] = [];
  const keep = (key: string) => {
    const value = query.get(key);
    if (value) kept.push(`${key}=${encodeURIComponent(value)}`);
  };
  if (path === "/signals" && query.get("metric")) {
    keep("metric");
    keep("snapshot");
    if (query.get("view") === "chart") keep("view");
  } else if (path === "/brief") keep("t");
  return `${base.replace(/\/+$/, "")}${path}${kept.length ? `?${kept.join("&")}` : ""}`;
}
