import { describe, expect, it } from "vitest";
import { parseByteRange } from "./byteRange";

const SIZE = 1000;

describe("parseByteRange", () => {
  it("serves the whole file when nothing was asked for", () => {
    expect(parseByteRange(undefined, SIZE)).toBeNull();
    expect(parseByteRange("", SIZE)).toBeNull();
  });

  it("reads an open-ended range as everything from the offset", () => {
    expect(parseByteRange("bytes=200-", SIZE)).toEqual({ start: 200, end: 999 });
  });

  it("reads a closed range inclusively, which is what Content-Range means", () => {
    // bytes=0-99 is 100 bytes, not 99. Getting this off by one truncates every
    // chunk a fetcher asks for.
    expect(parseByteRange("bytes=0-99", SIZE)).toEqual({ start: 0, end: 99 });
  });

  it("reads a suffix range as the LAST n bytes, not the first", () => {
    // "bytes=-500" is the tail of the file. Read the obvious way it serves the
    // wrong half with a 206 claiming otherwise, which is worse than an error.
    expect(parseByteRange("bytes=-500", SIZE)).toEqual({ start: 500, end: 999 });
  });

  it("clamps a range that runs past the end rather than reading off the buffer", () => {
    expect(parseByteRange("bytes=900-5000", SIZE)).toEqual({ start: 900, end: 999 });
  });

  it("calls a range that starts past the end unsatisfiable", () => {
    expect(parseByteRange("bytes=1000-", SIZE)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=2000-3000", SIZE)).toBe("unsatisfiable");
  });

  it("rejects a backwards range", () => {
    expect(parseByteRange("bytes=500-200", SIZE)).toBe("unsatisfiable");
  });

  it("rejects a suffix range of nothing", () => {
    expect(parseByteRange("bytes=-0", SIZE)).toBe("unsatisfiable");
  });

  it("serves the whole file for a form it does not handle", () => {
    // Multipart ranges are legal and nothing here has ever sent one. Answering
    // in full is a valid response; inventing a multipart encoder is not.
    expect(parseByteRange("bytes=0-99,200-299", SIZE)).toBeNull();
    expect(parseByteRange("items=0-99", SIZE)).toBeNull();
  });

  it("serves nothing special for an empty file", () => {
    expect(parseByteRange("bytes=0-", 0)).toBeNull();
  });
});
