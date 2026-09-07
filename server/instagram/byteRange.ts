/**
 * Byte-range parsing for the temporary video URL.
 *
 * Instagram fetches the file at the URL handed to `createReelContainer`, and
 * video fetchers routinely ask for it in pieces — a `Range` header for the
 * first few hundred kilobytes to read the container header, then the rest.
 * Express's `res.send(buffer)` ignores `Range` entirely and answers every
 * request with the whole file and a 200, which a fetcher is entitled to treat
 * as a server that cannot serve the file it asked for.
 *
 * The images have never needed this: nothing sends a Range for a 200KB JPEG.
 * Video is where it starts to matter, and it is a handful of lines against a
 * failure that would present as "Instagram just would not accept the Reel".
 */

export type ByteRange = { start: number; end: number };

/**
 * Parse a `Range` header against a known file size.
 *
 * Returns null when there is no range to honour (absent, or a form we do not
 * serve) and the caller should send the whole file, or "unsatisfiable" when the
 * client asked for bytes past the end, which is a 416 rather than a 200.
 *
 * Only single `bytes=` ranges are handled. Multipart ranges are legal and
 * nothing in this path has ever sent one; answering the whole file is a valid
 * response to a range we do not support, and inventing a multipart encoder for
 * a hypothetical client is not.
 */
export function parseByteRange(
  header: string | undefined,
  size: number
): ByteRange | null | "unsatisfiable" {
  if (!header || size <= 0) return null;
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, rawStart, rawEnd] = match;

  // "bytes=-500" is the LAST 500 bytes, not the first 500. Reading it the
  // obvious way serves the wrong half of the file with a 206 saying otherwise.
  if (rawStart === "") {
    if (rawEnd === "") return null;
    const wanted = Number(rawEnd);
    if (wanted <= 0) return "unsatisfiable";
    return { start: Math.max(0, size - wanted), end: size - 1 };
  }

  const start = Number(rawStart);
  if (start >= size) return "unsatisfiable";
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) return "unsatisfiable";
  return { start, end };
}
