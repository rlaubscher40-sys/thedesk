# The Desk

Private intelligence briefing tool for Ruben Laubscher (Head of Partnerships, InvestorKit). This is the rebuild of [`rlaubscher40-sys/thesignal`](https://github.com/rlaubscher40-sys/thesignal) — same product, same routes, same design system, but cleaner.

## What's different from the original

- **Typed JSON columns.** Every `json` column on the `editions` table is typed against a Zod schema in `shared/schemas.ts`. No more `any`, no more `Record<string, unknown>`.
- **Validated tRPC inputs.** Every mutation and query input runs through Zod. The scheduled routes likewise validate with Zod and return a flattened `issues` object on failure.
- **Prompts extracted.** Every LLM prompt lives in `server/prompts/`, composed from a single `voiceRules` constant. Change the voice once, every generator follows.
- **Routers split.** `server/routers/{auth,editions,feed,topics,readingQueue,notes,conversations,trends,search}.ts` — each file does one thing.
- **Components split.** `EditionReader.tsx` is ~50 lines that compose `EditionHero`, `LeadStory`, `TopicCard`, `SignalsBriefs`, `TalkingPointsBlock`, `EditionAdminPanel`. `DailyFeed.tsx` composes `FeedDatePicker`, `FeedItemCard`, `FeedSkeleton`. Every section sits behind a `<SectionErrorBoundary>` so one bad topic doesn't crash the page.
- **Loading skeletons everywhere.** No more blank screens — `DailyFeed`, `Editions`, `ReadingQueue`, `Trends`, `Topics`, `Search` and `Story` all paint placeholder rows immediately.
- **Optimistic mutations.** Adding, removing and marking-read on the reading queue all update local cache first and roll back on error. No spinner-tap-spinner.
- **Parallel backfill.** `editions.backfillRubensTake` runs all editions through `Promise.allSettled` instead of awaiting one at a time. 10 editions in roughly the time one used to take.
- **LinkedIn character counter.** The share modal shows a colour-coded counter (green ≤ 2,500, amber ≤ 3,000, red beyond) plus a progress bar. The post can be copy-only or copy-and-open.
- **Substack draft badge.** Editions with a saved draft show a small amber pill on the list rail.
- **"Regenerate image only" button.** Lets the admin swap the Substack hero image without touching the essay.
- **Fixed React key warnings.** All `.map()` calls compose `field || \`fallback-${idx}\`` keys and filter blank entries.

## Stack

- React 19, Tailwind 4, Wouter, tRPC 11, Superjson, Framer Motion, Sonner, Lucide
- Node 22, Express 4, Drizzle ORM, MySQL/TiDB
- Vite 7 dev server piggybacked on Express (same port)

## How to run

```bash
pnpm install
pnpm db:push          # generates + runs the migration
pnpm dev              # http://localhost:3000
pnpm test             # vitest
pnpm check            # tsc --noEmit
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

```
DATABASE_URL          MySQL connection string
JWT_SECRET            Session cookie signing key
VITE_APP_ID           Manus OAuth app ID
OAUTH_SERVER_URL      Manus OAuth backend
VITE_OAUTH_PORTAL_URL Manus login portal
BUILT_IN_FORGE_API_URL
BUILT_IN_FORGE_API_KEY
SCHEDULED_API_KEY     auth for /api/scheduled/* POSTs
OWNER_OPEN_ID         your openId — auto-promoted to admin on first sign-in
```

## Project layout

```
shared/              Zod schemas + constants the client and server both import
  const.ts           Cookie name, persona list, LinkedIn limits, category enum
  schemas.ts         Zod for topics, key metrics, ingestion payloads, partner tags
  errors.ts          HttpError helpers
  types.ts           Re-exports everything for one-line imports

server/
  index.ts           Express entry — wires tRPC, OAuth, scheduled routes, Vite
  core/              Env, LLM, image, storage, cookies, OAuth callback, SDK
  db/                Drizzle schema + one query file per domain
  prompts/           Every LLM prompt the server uses
  routers/           One router file per top-level slice
  scheduledRoutes.ts /api/scheduled/{daily-feed,weekly-edition}

client/
  index.html
  src/
    App.tsx          Routes + providers + onboarding + breaking toast
    main.tsx         tRPC client + QueryClient + 401 redirect hook
    index.css        Tailwind 4 theme tokens
    lib/             cn, trpc, auth, date, category, theme, useAuth
    components/
      AppLayout.tsx          Shell — sidebar, mobile drawer, tab bar
      ErrorBoundary.tsx      App-level + section-level
      LinkedInPostModal.tsx  Char counter, copy-and-open
      OnboardingModal.tsx    4-step intro, localStorage flagged
      BreakingSignalToast.tsx
      PageHeader.tsx
      ui/                    Button, Dialog, Skeleton, Toaster (sonner)
      feed/                  FeedItemCard, FeedDatePicker, FeedSkeleton,
                             SayThisLine, PartnerTagBlock
      editions/              EditionReader, EditionHero, LeadStory, TopicCard,
                             SignalsBriefs, TalkingPointsBlock,
                             EditionAdminPanel, EditionListItem,
                             EditionReaderSkeleton
    pages/                   One file per route — DailyFeed, Editions, Notes,
                             ReadingQueue, ConversationTracker, SearchPage,
                             TopicThreads, Trends, StoryPage, About, NotFound
```

## Design system

- Background: `oklch(0.13 0.018 260)` (deep navy)
- Foreground: `oklch(0.93 0.005 80)` (warm off-white)
- Accent: `oklch(0.75 0.18 70)` (amber)
- Fonts: Playfair Display (headings), Source Sans 3 (body), JetBrains Mono (overlines, metrics)
- No rounded cards on primary editorial content. Hairline borders only.

## Ruben's voice rules

Embedded in `server/prompts/voice.ts`. Two reusable strings — `voiceRules` and `rubensVoiceSamples` — that every generator composes. Change the rules in one place; every prompt updates.

## Scheduled API

```
POST /api/scheduled/daily-feed
Authorization: X-Scheduled-Key: $SCHEDULED_API_KEY  (or ?key=...)
Body: { items: [{ feedDate, title, source, summary, category, ... }] }
```

```
POST /api/scheduled/weekly-edition
Authorization: X-Scheduled-Key: $SCHEDULED_API_KEY
Body: { editionNumber, weekOf, weekRange, topics: [...], signals: [...], keyMetrics: {...} }
```

Both validate with Zod and respond before kicking LLM enrichment off in the background (so the cron task never times out).

## License

Private. Not for public distribution.
