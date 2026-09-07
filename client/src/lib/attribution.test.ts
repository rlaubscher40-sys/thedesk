import { describe, expect, it } from "vitest";
import { channelForHost, parseArrival } from "./attribution";

describe("parseArrival", () => {
  it("files a visit with no referrer and no tag as direct", () => {
    expect(parseArrival("", "")).toEqual({ source: "direct", campaign: null });
  });

  it("names the channel behind a known referrer", () => {
    expect(parseArrival("https://www.instagram.com/", "").source).toBe("instagram");
    expect(parseArrival("https://l.instagram.com/?u=x", "").source).toBe("instagram");
    expect(parseArrival("https://lnkd.in/abc", "").source).toBe("linkedin");
    expect(parseArrival("https://t.co/abc", "").source).toBe("x");
  });

  it("prefers a tagged link over the referrer", () => {
    // Instagram's in-app browser often sends no referrer at all, so the tag is
    // the only signal that survives. It has to win when both are present, or a
    // tagged campaign gets filed under whatever browser chrome leaked instead.
    const a = parseArrival("https://www.google.com/", "?utm_source=instagram");
    expect(a.source).toBe("instagram");
  });

  it("reads a tag even when the referrer is missing entirely", () => {
    expect(parseArrival("", "?utm_source=instagram&utm_campaign=bio-link")).toEqual({
      source: "instagram",
      campaign: "bio-link",
    });
  });

  it("accepts the short ref= form as well as utm_source", () => {
    expect(parseArrival("", "?ref=ig").source).toBe("ig");
  });

  it("marks same-origin entry as internal so our own pages are not a channel", () => {
    const a = parseArrival("https://thedesk.au/editions", "", "thedesk.au");
    expect(a.source).toBe("internal");
  });

  it("ignores a leading www when comparing against our own host", () => {
    expect(parseArrival("https://www.thedesk.au/x", "", "thedesk.au").source).toBe("internal");
    expect(parseArrival("https://thedesk.au/x", "", "www.thedesk.au").source).toBe("internal");
  });

  it("survives a malformed referrer rather than throwing", () => {
    expect(parseArrival("not a url", "").source).toBe("direct");
  });

  it("reads only the whitelisted keys, so a URL cannot leak identifiers", () => {
    // A link carrying a token must not put that token into storage or the DB.
    const a = parseArrival("", "?utm_source=instagram&email=someone@example.com&token=abc123");
    expect(a.source).toBe("instagram");
    expect(JSON.stringify(a)).not.toContain("example.com");
    expect(JSON.stringify(a)).not.toContain("abc123");
  });

  it("slugs a hostile or untidy tag instead of storing it raw", () => {
    const a = parseArrival("", "?utm_source=%3Cscript%3Ealert(1)%3C/script%3E");
    expect(a.source).not.toContain("<");
    expect(a.source).not.toContain(">");
  });

  it("truncates an absurdly long tag", () => {
    const a = parseArrival("", `?utm_source=${"x".repeat(500)}`);
    expect(a.source.length).toBeLessThanOrEqual(48);
  });

  it("falls back to the referrer when the tag is present but empty", () => {
    expect(parseArrival("https://www.instagram.com/", "?utm_source=").source).toBe("instagram");
  });

  it("keeps the campaign name alongside a referrer-derived source", () => {
    const a = parseArrival("https://www.instagram.com/", "?utm_campaign=spring-push");
    expect(a).toEqual({ source: "instagram", campaign: "spring-push" });
  });

  it("falls back to utm_medium when there is no utm_campaign", () => {
    expect(parseArrival("", "?utm_medium=social").campaign).toBe("social");
  });
});

describe("channelForHost", () => {
  it("keeps an unrecognised host rather than lumping it into other", () => {
    // A referrer we have no opinion about is still information. Collapsing it
    // to "other" would hide a channel that started working.
    expect(channelForHost("afr.com")).toBe("afr.com");
  });

  it("strips www so one site is not two channels", () => {
    expect(channelForHost("www.afr.com")).toBe("afr.com");
  });

  it("separates Google News from Google search", () => {
    // They are different acquisition stories and should not be one row.
    expect(channelForHost("news.google.com")).toBe("google-news");
    expect(channelForHost("google.com")).toBe("google");
    expect(channelForHost("google.com.au")).toBe("google");
  });

  it("does not match a lookalike domain as the real channel", () => {
    expect(channelForHost("notinstagram.com")).toBe("notinstagram.com");
    expect(channelForHost("instagram.com.evil.net")).toBe("instagram.com.evil.net");
  });
});
