import { useState } from "react";
import { useLocation } from "wouter";
import { SOCIAL_DESTINATIONS, socialStoryPath } from "@shared/socialDestinations";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

/** Works behind the already-tagged homepage bio link, without editing Instagram. */
export function SocialStart({ compact = false }: { compact?: boolean }) {
  const published = trpc.instagram.publishedStories.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
  });
  const [storyId, setStoryId] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  return (
    <section aria-label="Reel sources" className="rule-major py-6 my-5">
      <p className="bs-label-accent">Seen a post? Start here</p>
      <h2 className="font-serif text-3xl mt-2">Find the story behind the post.</h2>
      <p className="text-sm leading-6 mt-3">
        Match the topic you watched to its evidence. Free to read, without an account or an AI
        question.
      </p>
      {!!published.data?.length && (
        <div className="mt-5" aria-label="Recent carousel stories">
          <h3 className="bs-label-accent">Recent carousel stories</h3>
          {published.data.slice(0, compact ? 3 : 6).map((story) => (
            <a
              key={story.id}
              href={story.path}
              className="block rule-hair py-4 bs-link"
              onClick={() => trackEvent("social_open", "social")}
            >
              <p className="text-xs text-[var(--color-fg-muted)]">
                Posted{" "}
                {new Intl.DateTimeFormat("en-AU", {
                  timeZone: "Australia/Sydney",
                  day: "numeric",
                  month: "short",
                }).format(new Date(story.publishedAt))}{" "}
                · {story.source}
              </p>
              <p className="font-serif text-xl mt-2">{story.title} →</p>
            </a>
          ))}
        </div>
      )}
      {published.isError && (
        <p className="text-sm mt-4" role="status">
          Recent carousel links could not load. Use the story number below or try again later.
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-x-7 mt-4">
        {SOCIAL_DESTINATIONS.map((item) => (
          <a
            key={item.path}
            href={item.path}
            onClick={() => trackEvent("social_open", "social")}
            className="block rule-hair py-4 bs-link"
          >
            <h3 className="font-serif text-xl">{item.label} →</h3>
            <p className="text-sm mt-2 text-[var(--color-fg-muted)]">{item.detail}</p>
          </a>
        ))}
        <a
          href="/social#capital-rents"
          onClick={() => trackEvent("social_open", "social")}
          className="block rule-hair py-4 bs-link"
        >
          All eight capital-city rent figures →
        </a>
      </div>
      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          const path = socialStoryPath(storyId.trim());
          if (!path) {
            setError("Enter the story number shown in the caption.");
            return;
          }
          trackEvent("social_open", "social");
          navigate(path);
        }}
      >
        <label className="text-sm block" htmlFor="social-story-number">
          Looking for another carousel? Enter its “Read story” number
        </label>
        <div className="flex flex-wrap gap-2 mt-2">
          <input
            id="social-story-number"
            inputMode="numeric"
            value={storyId}
            maxLength={10}
            onChange={(event) => setStoryId(event.target.value)}
            className="border border-[var(--color-border)] bg-transparent p-3 min-w-0"
            placeholder="Story number"
          />
          <button className="bs-btn bs-btn-solid">Open story</button>
        </div>
        {error && (
          <p role="alert" className="text-sm mt-2">
            {error}
          </p>
        )}
      </form>
      <p className="text-xs mt-4 text-[var(--color-fg-muted)]">
        Data pages show the latest available observations and may have changed since the post. Check
        its reference month. Older stories are also searchable in{" "}
        <a className="bs-link" href="/archive">
          Archive
        </a>
        .
      </p>
    </section>
  );
}
