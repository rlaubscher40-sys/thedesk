import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isKnownRoute, isNoindexRoute, withNoindex } from "./spaShell";

describe("isKnownRoute", () => {
  it("accepts the public pages", () => {
    for (const route of ["/", "/editions", "/archive", "/trends", "/topics", "/about"]) {
      expect(isKnownRoute(route), route).toBe(true);
    }
  });

  it("accepts the parameterised routes", () => {
    expect(isKnownRoute("/editions/12")).toBe(true);
    expect(isKnownRoute("/topics/PROPERTY")).toBe(true);
    expect(isKnownRoute("/story/4821")).toBe(true);
  });

  it("rejects anything the router has no page for", () => {
    expect(isKnownRoute("/wp-admin")).toBe(false);
    expect(isKnownRoute("/editions/12/extra")).toBe(false);
    expect(isKnownRoute("/story")).toBe(false);
    expect(isKnownRoute("/about-us")).toBe(false);
    expect(isKnownRoute("/favicon.png")).toBe(false);
  });

  /**
   * The route table is duplicated between the router and spaShell.ts, and a
   * route added to one but not the other 404s in production while working
   * fine in dev. Read the real <Route path="…"> list and hold them equal.
   */
  it("covers every route declared in App.tsx", () => {
    const app = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../client/src/App.tsx"),
      "utf-8"
    );
    const declared = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1] as string);
    expect(declared.length).toBeGreaterThan(10);

    for (const route of declared) {
      // Substitute a value for each :param to get a concrete URL.
      const concrete = route.replace(/:[^/]+/g, "1");
      expect(isKnownRoute(concrete), `${route} is missing from spaShell.ts`).toBe(true);
    }
  });
});

describe("isNoindexRoute", () => {
  it("covers the private and single-use pages", () => {
    for (const route of ["/admin", "/login", "/settings", "/queue", "/install", "/confirm"]) {
      expect(isNoindexRoute(route), route).toBe(true);
    }
  });

  it("leaves editorial pages indexable", () => {
    for (const route of ["/", "/editions", "/editions/12", "/story/1", "/about", "/archive"]) {
      expect(isNoindexRoute(route), route).toBe(false);
    }
  });
});

describe("withNoindex", () => {
  it("inserts the robots meta into <head>", () => {
    const out = withNoindex(
      "<!doctype html><html><head><title>x</title></head><body></body></html>"
    );
    expect(out).toContain('<meta name="robots" content="noindex, follow" />');
    expect(out.indexOf("robots")).toBeLessThan(out.indexOf("<title>"));
  });

  it("doesn't add a second one", () => {
    const once = withNoindex("<html><head><title>x</title></head></html>");
    expect(withNoindex(once)).toBe(once);
  });

  it("applies to the real built shell's head", () => {
    const shell = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../client/index.html"),
      "utf-8"
    );
    expect(withNoindex(shell)).toContain('content="noindex, follow"');
  });
});
