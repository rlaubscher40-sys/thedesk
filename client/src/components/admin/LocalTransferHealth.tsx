import { trpc } from "@/lib/trpc";
import { LOCAL_SOURCES } from "../../../../shared/localData";

const mib = (bytes: number) =>
  `${(bytes / 1_048_576).toLocaleString("en-AU", { maximumFractionDigits: 2 })} MiB`;
export function LocalTransferHealth() {
  const query = trpc.health.localTransferStats.useQuery(undefined, { refetchInterval: 60_000 });
  return (
    <section className="mt-6">
      <h4 className="font-semibold">Download measurements · last 30 UTC days</h4>
      <p className="mt-2 text-sm">
        Completed data-file responses only. Body bytes are not billed network traffic; avoided bytes
        are estimates based on the previous file size. Discovery requests, headers and failed
        partial transfers are excluded.
      </p>
      {query.isLoading ? (
        <p className="mt-2 text-sm">Loading measurements…</p>
      ) : query.isError ? (
        <p className="mt-2 text-sm">Download measurements are unavailable.</p>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th className="p-2">Source</th>
                <th className="p-2">Files downloaded</th>
                <th className="p-2">Unchanged (304)</th>
                <th className="p-2">Body received</th>
                <th className="p-2">Estimated avoided</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((row) => (
                <tr key={row.sourceKey} className="border-t border-[var(--color-rule)]">
                  <th className="p-2 font-normal">{LOCAL_SOURCES[row.sourceKey].label}</th>
                  {row.firstMeasuredAt ? (
                    <>
                      <td className="p-2">{row.downloads}</td>
                      <td className="p-2">{row.unchanged}</td>
                      <td className="p-2">{mib(row.bodyBytes)}</td>
                      <td className="p-2">
                        {mib(row.estimatedAvoidedBytes)}
                        {row.unknownSize > 0 && (
                          <span>
                            {" "}
                            · {row.unknownSize} unchanged responses have no size estimate
                          </span>
                        )}
                      </td>
                    </>
                  ) : (
                    <td className="p-2" colSpan={4}>
                      No completed file responses measured yet
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
