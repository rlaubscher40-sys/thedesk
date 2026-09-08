/** Strict CSV reader: quoted commas/newlines and doubled quotes are allowed. */
export function csvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]!;
    if (quoted) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += char;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (char !== ",") {
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
        if (char === "\r" && csv[i + 1] === "\n") i++;
      }
    } else if (char === '"' && !value && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error("Malformed ABS CSV");
      value += char;
    }
  }
  if (quoted) throw new Error("Unclosed ABS CSV field");
  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}
