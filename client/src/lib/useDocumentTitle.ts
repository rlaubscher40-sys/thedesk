/**
 * Sets `document.title` for the current page. Cheap alternative to
 * react-helmet-async for an SPA without per-request SSR — gives bookmarks,
 * browser history and screen-reader titles the right text, even though
 * search crawlers will still see the static title from index.html.
 */
import { useEffect } from "react";

const SUFFIX = " — The Desk";

export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.title;
    document.title = title ? `${title}${SUFFIX}` : `The Desk — Daily intelligence for property partnerships`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
