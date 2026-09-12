import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";
import { parse, type DefaultTreeAdapterMap } from "parse5";
const html = readFileSync("client/index.html", "utf8");
const scripts: string[] = [];
function visit(node: DefaultTreeAdapterMap["node"]) {
  if ("tagName" in node && node.tagName === "script" && !node.attrs.some((attr) => attr.name === "src")) {
    scripts.push(node.childNodes.map((child) => "value" in child ? child.value : "").join(""));
  }
  if ("childNodes" in node) node.childNodes.forEach(visit);
}
visit(parse(html));
const script = scripts.find((source) => source.includes("15000"))!;
afterEach(() => vi.useRealTimers());
it("offers a working retry when the main bundle never starts", async () => {
  vi.useFakeTimers();
  const children: any[] = [];
  const reload = vi.fn();
  const splash = { classList: { contains: () => false }, removeAttribute: vi.fn(), appendChild: (el: any) => children.push(el) };
  runInNewContext(script, { setTimeout, window: { location: { reload } }, document: {
    getElementById: () => splash,
    createElement: (tag: string) => ({ tag, style: {}, setAttribute: vi.fn(), addEventListener(_event: string, action: () => void) { this.click = action; } }),
  } });
  await vi.advanceTimersByTimeAsync(15000);
  expect(splash.removeAttribute).toHaveBeenCalledWith("aria-hidden");
  expect(children[0].textContent).toContain("longer than expected");
  children[1].click();
  expect(reload).toHaveBeenCalledOnce();
});
it("does nothing after a successful boot has dismissed the splash", async () => {
  vi.useFakeTimers();
  const createElement = vi.fn();
  runInNewContext(script, { setTimeout, document: { getElementById: () => null, createElement } });
  await vi.advanceTimersByTimeAsync(15000);
  expect(createElement).not.toHaveBeenCalled();
});
