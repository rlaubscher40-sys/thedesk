import { useState } from "react";
import { trpc } from "@/lib/trpc";

export function VicWorkbookUpload({ onImported }: { onImported: () => void }) {
  const [resourceUrl, setResourceUrl] = useState("");
  const [base64, setBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const mutation = trpc.health.importVicWorkbook.useMutation({
    onSuccess: result => { if (result.imported) onImported(); },
  });
  const busy = reading || mutation.isPending;
  const reset = () => { mutation.reset(); setError(""); };
  return <details className="mt-3 border-t border-[var(--color-rule)] pt-3">
    <summary className="cursor-pointer font-semibold">Upload an official Victorian workbook</summary>
    <p className="mt-2">If the download fails, supply the original quarterly LGA Excel file. Preview its council coverage and reporting quarter before importing. Suburb workbooks are a different dataset.</p>
    <label className="block mt-3">Official DFFH workbook link
      <input className="block w-full border border-[var(--color-rule)] bg-transparent p-2" type="url" value={resourceUrl} disabled={busy}
        onChange={event => { setResourceUrl(event.target.value.trim()); reset(); }} />
    </label>
    <label className="block mt-3">Excel workbook (up to 2 MB)
      <input className="block w-full mt-1" type="file" accept=".xlsx" disabled={busy}
        onChange={async event => {
          reset(); setBase64(""); setFileName("");
          const file = event.target.files?.[0];
          if (!file) return;
          if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 2_000_000) { setError("Choose an .xlsx file no larger than 2 MB."); return; }
          setReading(true);
          try {
            const value = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
              reader.onerror = () => reject(new Error("The file could not be read."));
              reader.readAsDataURL(file);
            });
            setBase64(value); setFileName(file.name);
          } catch { setError("The file could not be read."); }
          finally { setReading(false); }
        }} />
    </label>
    <button className="mt-3 border border-[var(--color-rule)] px-3 py-2 disabled:opacity-50" disabled={busy || !base64 || !resourceUrl}
      onClick={() => mutation.mutate({ base64, resourceUrl, commit: false })}>
      {busy ? "Checking workbook…" : "Preview workbook"}
    </button>
    {(error || mutation.error) && <p role="alert" className="mt-2">{error || mutation.error?.message}</p>}
    {mutation.data && <div role="status" className="mt-3">
      <p>{fileName}: quarter ended {mutation.data.period} · {mutation.data.areas} councils · {mutation.data.published} published figures · {mutation.data.unavailable} unavailable.</p>
      <p>The reporting quarter remains the date of these figures. A supplied file does not verify automatic download access.</p>
      {mutation.data.unchanged ? <p>This exact release is already stored.</p> : mutation.data.imported ? <p>Workbook imported. Markets and Ask can now use this release.</p> :
        <button className="mt-2 border border-[var(--color-rule)] px-3 py-2" disabled={busy}
          onClick={() => mutation.mutate({ base64, resourceUrl, commit: true, expectedHash: mutation.data?.hash })}>Import validated workbook</button>}
    </div>}
  </details>;
}
