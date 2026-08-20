import { describe, expect, it } from "vitest";
import { countryFromEdge } from "./analyticsRoutes";

describe("countryFromEdge", () => {
  it("accepts a normal ISO alpha-2 code", () => {
    expect(countryFromEdge("AU")).toBe("AU");
    expect(countryFromEdge("FR")).toBe("FR");
  });

  it("normalises case and surrounding whitespace", () => {
    expect(countryFromEdge("au")).toBe("AU");
    expect(countryFromEdge(" Au ")).toBe("AU");
  });

  it("treats Cloudflare's unknown sentinels as no country", () => {
    // XX = Cloudflare couldn't determine it; T1 = Tor exit node.
    // Both are valid header values but neither is a place.
    expect(countryFromEdge("XX")).toBeNull();
    expect(countryFromEdge("xx")).toBeNull();
    expect(countryFromEdge("T1")).toBeNull();
  });

  it("returns null when the header is absent", () => {
    // Local dev, or a request that reached the origin without
    // passing through the proxy.
    expect(countryFromEdge(undefined)).toBeNull();
    expect(countryFromEdge("")).toBeNull();
  });

  it("rejects anything that isn't two ASCII letters", () => {
    expect(countryFromEdge("AUS")).toBeNull();
    expect(countryFromEdge("A")).toBeNull();
    expect(countryFromEdge("A1")).toBeNull();
    expect(countryFromEdge("--")).toBeNull();
    expect(countryFromEdge("'; DROP TABLE page_views; --")).toBeNull();
  });
});
