import { expect, it } from "vitest";
import { readableHtml, readableText } from "./htmlText";
it("removes inactive content using HTML parsing, including spaced closing tags", () => {
  const input =
    '<article><p>Visible data</p><script title="a > b">hidden()</script ><style>.hidden{}</style><noscript>fallback</noscript><template>inert</template><!-- comment --></article>';
  expect(readableText(input)).toBe("Visible data");
  expect(readableHtml(input)).not.toContain("hidden");
});
it("decodes entities exactly once and preserves word boundaries", () => {
  expect(readableText("<p>A &amp;amp; B &amp; C</p><p>&#39;Quote&#39; &nbsp;next</p>")).toBe(
    "A &amp; B & C 'Quote' next"
  );
});
