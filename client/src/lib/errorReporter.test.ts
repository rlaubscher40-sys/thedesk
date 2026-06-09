import { describe, expect, it } from "vitest";
import { isIgnorableError } from "./errorReporter";

describe("isIgnorableError", () => {
  it("filters the iOS WebView native-bridge error (not our code)", () => {
    // The exact error seen in the wild: an in-app browser's injected bridge
    // calling window.webkit.messageHandlers where it isn't available.
    expect(
      isIgnorableError(
        "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
        "sendDataToNative@https://thedesk.au/:1:1325\nsendPageHideMessage@https://thedesk.au/:1:4139"
      )
    ).toBe(true);
  });

  it("filters other known third-party / benign noise", () => {
    expect(isIgnorableError("Extension context invalidated.", null)).toBe(true);
    expect(isIgnorableError("ResizeObserver loop completed with undelivered notifications.", null)).toBe(
      true
    );
  });

  it("does NOT filter genuine app errors", () => {
    expect(isIgnorableError("Cannot read properties of undefined (reading 'map')", null)).toBe(false);
    expect(isIgnorableError("TypeError: trpc.feed.getByDate is not a function", null)).toBe(false);
    expect(isIgnorableError("Network request failed", null)).toBe(false);
  });
});
