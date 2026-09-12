/** Network failure is different from an empty feed or a missing story. */
export function ConnectionNotice({ retry, retrying = false }: { retry: () => void; retrying?: boolean }) {
  return <div role="status" className="my-6 border border-[var(--color-border)] p-5">
    <p className="font-semibold">We couldn't finish loading this content.</p>
    <p className="mt-2 text-sm text-[var(--color-fg-muted)]">Check your connection and try again. Anything already loaded is still available.</p>
    <button type="button" className="bs-link mt-3 min-h-[44px]" disabled={retrying} onClick={retry}>
      {retrying ? "Trying again…" : "Try again"}
    </button>
  </div>;
}
