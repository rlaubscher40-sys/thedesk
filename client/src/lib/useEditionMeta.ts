/**
 * Writes per-edition meta tags into document.head. Most modern social
 * crawlers (LinkedIn, Twitter/X, Slack, Facebook, Discord) execute JS
 * before grabbing OG tags, so this gets us a correct preview card for
 * the share button surface. Google still sees the static tags from
 * index.html, server-side meta injection would cover that gap; see
 * server/core/seo.ts for the eventual home for that.
 *
 * Cleans up on unmount so navigating back to a non-edition page restores
 * the site-wide defaults.
 */
import { useEffect } from "react";

export type EditionMeta = {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string | null;
  url?: string;
};

function setOrCreateMeta(
  selector: string,
  attrName: "name" | "property",
  attrValue: string,
  content: string
): { node: HTMLMetaElement; created: boolean; previous: string | null } {
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  let created = false;
  let previous: string | null = null;
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attrName, attrValue);
    document.head.appendChild(node);
    created = true;
  } else {
    previous = node.getAttribute("content");
  }
  node.setAttribute("content", content);
  return { node, created, previous };
}

export function useEditionMeta(meta: EditionMeta | null): void {
  useEffect(() => {
    if (!meta) return;
    if (typeof document === "undefined") return;

    const previousTitle = document.title;
    document.title = `${meta.title}, The Desk`;

    const trackers: Array<() => void> = [];

    function applyMeta(
      selector: string,
      attrName: "name" | "property",
      attrValue: string,
      content: string | undefined | null
    ) {
      if (!content) return;
      const { node, created, previous } = setOrCreateMeta(
        selector,
        attrName,
        attrValue,
        content
      );
      trackers.push(() => {
        if (created) node.remove();
        else if (previous !== null) node.setAttribute("content", previous);
      });
    }

    applyMeta('meta[name="description"]', "name", "description", meta.description);
    applyMeta('meta[property="og:title"]', "property", "og:title", meta.ogTitle ?? meta.title);
    applyMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
      meta.ogDescription ?? meta.description
    );
    applyMeta('meta[property="og:type"]', "property", "og:type", "article");
    if (meta.ogImage) {
      applyMeta('meta[property="og:image"]', "property", "og:image", meta.ogImage);
    }
    if (meta.url) {
      applyMeta('meta[property="og:url"]', "property", "og:url", meta.url);
    }
    applyMeta(
      'meta[name="twitter:title"]',
      "name",
      "twitter:title",
      meta.ogTitle ?? meta.title
    );
    applyMeta(
      'meta[name="twitter:description"]',
      "name",
      "twitter:description",
      meta.ogDescription ?? meta.description
    );
    if (meta.ogImage) {
      applyMeta('meta[name="twitter:image"]', "name", "twitter:image", meta.ogImage);
    }

    return () => {
      document.title = previousTitle;
      for (const restore of trackers) restore();
    };
  }, [
    meta?.title,
    meta?.description,
    meta?.ogTitle,
    meta?.ogDescription,
    meta?.ogImage,
    meta?.url,
  ]);
}
