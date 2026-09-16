/** A visible, keyboard-operable alternative to chart colours and hover values. */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <details className="mt-3 text-sm text-[var(--color-fg-muted)]">
      <summary className="py-2 underline underline-offset-4">View data: {caption}</summary>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column, i) => (
                <th key={i} scope="col" className="border-b border-[var(--color-border)] p-2">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((value, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="p-2 font-normal">
                      {value}
                    </th>
                  ) : (
                    <td key={j} className="p-2">
                      {value}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
