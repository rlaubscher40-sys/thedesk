import { describe, expect, it } from "vitest";
import {
  decodeGoogleNewsUrlOffline,
  gnewsArticleId,
  isGoogleNewsUrl,
  parseBatchExecuteUrl,
} from "./gnews";

describe("isGoogleNewsUrl", () => {
  it("flags news.google.com links", () => {
    expect(isGoogleNewsUrl("https://news.google.com/rss/articles/CBMiabc?oc=5")).toBe(true);
  });
  it("passes through publisher links", () => {
    expect(isGoogleNewsUrl("https://www.abc.net.au/news/story")).toBe(false);
    expect(isGoogleNewsUrl("https://www.theguardian.com/x")).toBe(false);
  });
  it("is null-safe", () => {
    expect(isGoogleNewsUrl(null)).toBe(false);
    expect(isGoogleNewsUrl(undefined)).toBe(false);
    expect(isGoogleNewsUrl("not a url")).toBe(false);
  });
});

describe("gnewsArticleId", () => {
  it("extracts the id from an rss/articles link", () => {
    expect(gnewsArticleId("https://news.google.com/rss/articles/CBMiTOKEN?oc=5&hl=en")).toBe(
      "CBMiTOKEN"
    );
  });
  it("extracts the id from a web /articles link", () => {
    expect(gnewsArticleId("https://news.google.com/articles/CBMiABC")).toBe("CBMiABC");
  });
  it("extracts the id from a /read link", () => {
    expect(gnewsArticleId("https://news.google.com/read/XYZ123?foo=1")).toBe("XYZ123");
  });
  it("returns null for non-article paths", () => {
    expect(gnewsArticleId("https://news.google.com/rss/search?q=x")).toBeNull();
  });
});

describe("decodeGoogleNewsUrlOffline", () => {
  it("lifts an embedded publisher URL out of the old-format id", () => {
    // Old format: the base64 payload contains the destination URL verbatim,
    // wrapped in a couple of protobuf framing bytes.
    const target = "https://www.example.com/news/story-123";
    const blob = Buffer.concat([
      Buffer.from([0x08, 0x13, 0x22, target.length]),
      Buffer.from(target, "latin1"),
      Buffer.from([0x12, 0x06]),
    ]);
    const id = blob.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeGoogleNewsUrlOffline(id)).toBe(target);
  });

  it("ignores google's own domains in the payload", () => {
    const blob = Buffer.from("\x08\x13https://www.google.com/foo", "latin1");
    const id = blob.toString("base64url");
    expect(decodeGoogleNewsUrlOffline(id)).toBeNull();
  });

  it("returns null for the newer signed format (no inline URL)", () => {
    const blob = Buffer.from("\x08AU_yqLsomeopaquesignedpayload", "latin1");
    const id = blob.toString("base64url");
    expect(decodeGoogleNewsUrlOffline(id)).toBeNull();
  });

  it("is robust to garbage input", () => {
    expect(decodeGoogleNewsUrlOffline("!!!notbase64!!!")).toBeNull();
    expect(decodeGoogleNewsUrlOffline("")).toBeNull();
  });
});

describe("parseBatchExecuteUrl", () => {
  it("extracts the destination URL from a batchexecute response", () => {
    const inner = JSON.stringify(["garturlres", "https://www.smh.com.au/business/story-abc"]);
    const outer = JSON.stringify([["wrb.fr", "Fbv4je", inner, null, null, null, "generic"]]);
    const body = `)]}'\n\n123\n${outer}\n45\n[["di",99]]`;
    expect(parseBatchExecuteUrl(body)).toBe("https://www.smh.com.au/business/story-abc");
  });

  it("returns null when no garturlres line is present", () => {
    expect(parseBatchExecuteUrl(')]}\'\n[["di",1]]')).toBeNull();
  });

  it("rejects a google domain destination", () => {
    const inner = JSON.stringify(["garturlres", "https://news.google.com/x"]);
    const outer = JSON.stringify([["wrb.fr", "Fbv4je", inner]]);
    expect(parseBatchExecuteUrl(outer)).toBeNull();
  });
});
