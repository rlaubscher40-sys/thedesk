export function editorialCategory(title: string, summary: string, fallback: string): string {
  const sports =
    /\b(football|soccer|premier league|champions league|rugby|cricket|tennis|grand prix|match report|full.time score)\b/i.test(
      title
    );
  const policy =
    /\b(government|sanctions|diploma(?:cy|tic)|parliament|election|legislation|foreign policy|war|military|state funding|housing)\b/i.test(
      `${title} ${summary}`
    );
  return sports && !policy && fallback === "GEOPOLITICS" ? "OTHER" : fallback;
}
