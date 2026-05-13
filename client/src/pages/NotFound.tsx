import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";

export default function NotFound() {
  return (
    <div>
      <PageHeader overline="404" title="That page is not here." />
      <p className="text-sm text-[var(--color-fg-muted)]">
        Try{" "}
        <Link href="/" className="text-amber-300 hover:underline">
          Today
        </Link>
        ,{" "}
        <Link href="/editions" className="text-amber-300 hover:underline">
          Editions
        </Link>{" "}
        or{" "}
        <Link href="/search" className="text-amber-300 hover:underline">
          Search
        </Link>
        .
      </p>
    </div>
  );
}
