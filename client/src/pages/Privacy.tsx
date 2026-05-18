/**
 * Privacy page. Plain-language summary of what The Desk collects, how it's
 * used, and how to ask for changes. Kept short on purpose, readers don't
 * read long privacy policies, and a B2B audience scrutinises every line.
 */
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export default function Privacy() {
  useDocumentTitle("Privacy");
  return (
    <article className="max-w-[68ch] mx-auto py-10 space-y-6 leading-relaxed">
      <header className="space-y-2">
        <p
          className="overline-amber"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          The Desk
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">
          Privacy
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Last updated: {new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl mt-8">What we collect</h2>
        <ul className="list-disc pl-5 space-y-2 text-[var(--color-fg)]">
          <li>
            <strong>Email address</strong> if you subscribe to the daily
            brief. Used only to send you that brief, plus the occasional
            edition note.
          </li>
          <li>
            <strong>Anonymous analytics</strong>: which pages and stories are
            opened. No cookies that identify you personally. No tracking
            across other sites.
          </li>
          <li>
            <strong>Local preferences</strong>: your selected audience
            persona, theme, reading queue and bookmarks live in your
            browser's local storage. They never leave your device.
          </li>
        </ul>

        <h2 className="font-serif text-2xl mt-8">What we don't do</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>We don't sell or share your email with anyone.</li>
          <li>We don't run third-party ad trackers.</li>
          <li>We don't build profiles for targeting.</li>
        </ul>

        <h2 className="font-serif text-2xl mt-8">Getting your data, or removing it</h2>
        <p>
          Reply to any brief and ask for export, correction or deletion of
          anything we hold on you. We'll action it within 30 days.
        </p>

        <h2 className="font-serif text-2xl mt-8">Contact</h2>
        <p>
          Questions: reply to any brief, or reach Ruben directly on
          {" "}
          <a
            className="text-amber-300 hover:text-amber-200 transition-colors"
            href="https://www.linkedin.com/in/ruben-laubscher/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
          .
        </p>
      </section>
    </article>
  );
}
