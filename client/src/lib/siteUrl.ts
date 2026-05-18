/**
 * The site's public URL, used in LinkedIn share strings and other
 * outbound references. Reads `VITE_SITE_URL` at build time so
 * deployments at different domains share-link to the right place.
 */
import { DEFAULT_SITE_URL } from "@shared/const";

export const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? DEFAULT_SITE_URL;

/** Convenience: "yourdomain.com" without protocol, for footer text. */
export const SITE_DISPLAY = SITE_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");
