import { nextPublicationSlot } from "@shared/nextPublication";
import { WebVitalsPanel } from "./WebVitalsPanel";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { REEL_WINDOW } from "@shared/instagramSchedule";
export function OperationsOverview() {
  const health = trpc.health.summary.useQuery(undefined, { staleTime: 60_000 });
  const posts = trpc.instagram.listAll.useQuery({ limit: 5 }, { staleTime: 60_000 });
  const latest = posts.data?.[0];
  const next = nextPublicationSlot();
  const errors = trpc.health.recentErrors.useQuery({ limit: 1 }, { staleTime: 60_000 });
  return (
    <>
      <section aria-label="Operations overview" className="grid md:grid-cols-3 gap-5">
        <article className="rule-major pt-4">
          <h2 className="font-serif text-2xl">Needs attention</h2>
          <p role="status" className="mt-3">
            {health.isLoading
              ? "Checking service health…"
              : health.isError
                ? "Service health could not be read."
                : `${health.data?.errors.last24h ?? 0} recorded server errors in the last 24 hours.`}
          </p>
          {errors.data?.[0] && (
            <p className="text-sm mt-2 break-words">Latest: {errors.data[0].message}</p>
          )}
          <Link href="/admin?section=data" className="bs-link min-h-11 py-3 inline-block">
            Inspect source health and failures →
          </Link>
        </article>
        <article className="rule-major pt-4">
          <h2 className="font-serif text-2xl">Next scheduled slot</h2>
          <p className="mt-3">
            {next ? `${next.name} · ${next.date}, ${next.at} Sydney` : "Schedule unavailable"}
          </p>
          <p className="text-sm mt-2">Subject to evidence and publication checks.</p>
          <p className="mt-2">Reel window: {REEL_WINDOW.label}, when evidence is ready.</p>
          <Link href="/admin?section=social" className="bs-link min-h-11 py-3 inline-block">
            Check next candidates and confirmed outcomes →
          </Link>
        </article>
        <article className="rule-major pt-4">
          <h2 className="font-serif text-2xl">Last recorded publication</h2>
          <p className="mt-3">
            {posts.isLoading
              ? "Reading publication records…"
              : posts.isError
                ? "Publication status unavailable."
                : (latest?.headline ?? "No publication recorded.")}
          </p>
          {latest && (
            <p className="text-sm mt-2">
              {new Date(latest.createdAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}{" "}
              Sydney · {latest.postType}
            </p>
          )}
          <Link href="/admin?section=social" className="bs-link min-h-11 py-3 inline-block">
            Inspect publication receipts →
          </Link>
        </article>
      </section>
      <WebVitalsPanel />
    </>
  );
}
