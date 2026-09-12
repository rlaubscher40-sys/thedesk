# Dead-code audit, 12 September 2026

Audited base: `40f5ed2fcc1b36ba8def441e65430d727e1ba057` (main after PR #252).

## Changes

- Deleted 43 unused implementation files and three tests dedicated to retired implementations. These include the disconnected old desk/feed/right-rail components, redundant subscription prompts, unused chart components, an unused feed-priority calculator, and superseded standalone counterpoint, daily-item QC, news-metric extraction and news-eligibility paths.
- Removed or made private unused exports and types across the client, server, shared modules and ingestion scripts. Removed obsolete query wrappers, unused sample metric/topic/ticker data, the unused LLM Reel-script generator, old fetch helpers and unused local variables/imports.
- Removed seven direct dependencies: `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `axios`, `date-fns` and `recharts`. Added pinned development-only `knip@6.35.1`. Regenerated the lockfile with the repository's pinned pnpm 10.34.5. Retained packages keep their direct versions; Vite-related peer snapshots additionally resolve Knip's YAML dependency.
- Removed 15 unused CSS class names and eight animations, including the replaced CSS orbs, old reveal/hero effects, bookmark animation and unused type scales. Kept current canvas, reduced-motion/lite-mode rules, active first-paint effects and responsive Tailwind utilities.
- Replaced the duplicate automatic-source-list alias with its existing canonical list. The values and scheduled jobs are identical.
- Fixed the paired bar chart's resize subscription: React now runs its measurement and listener cleanup through `useEffect`, instead of returning an unused cleanup function from `useMemo`.
- Corrected outdated package metadata and the README's component/route map.

## Repeatable gates

`pnpm audit:dead-code` runs Knip across application code, scripts, configuration, styles and tests. It fails on unused files, dependencies, exports/types, unresolved imports and duplicate exports, as well as configuration hints. CI runs it alongside the existing test, TypeScript, build and security checks.

`pnpm check` now rejects unused locals and parameters, and includes standalone TypeScript/MTS maintenance scripts in addition to client, server and shared code. This also exposed and fixed three preview scripts' Sharp type references.

The audit checks the complete graph, including tests and documented operational entry points. Production-only tracing was also reviewed separately, with explicit server/ingest entry points. An export used solely by a regression test is not automatically a dead implementation: many test visible internals of active modules. Dedicated tests were removed only with their superseded, uncalled implementations; current daily-angle, editorial-pipeline, source-validation and publishing tests remain.

## Deliberate retained entry points and exceptions

- The service worker is loaded by its public URL. The speech worker is copied into `dist/voice` and launched as a separate process. Both are explicit entries.
- Manual preview, source-probe and reviewed-import tools remain callable. Package scripts and framework/test configuration provide additional automatic entry points.
- Drizzle's schema is an explicit entry. Knip does not execute the credential-dependent Drizzle config. Database tables and migration history were retained; an unused TypeScript import does not prove stored data is disposable.
- `read-excel-file` is retained as the one dependency exception: `server/localData/workbook.ts` resolves its module URL and imports it inside a bounded worker. Workbook tests and the build exercise that dependency.
- Test fixtures, regression-test interfaces, source releases, licensed images/fonts and public brand/download assets are retained. Static import searches cannot establish whether an externally linked public asset is unused.
- Existing compatibility routes, confirmation/unsubscribe links, durable publication keys, ingestion source policy and approved Reel voice remain in place. This cleanup introduces no live publication, database mutation, paid source or scheduler.

## Validation

- Fresh `pnpm install --frozen-lockfile` completed with the revised dependency graph.
- Knip and the expanded TypeScript check pass. A temporary unreferenced module was deliberately introduced: the audit failed on it, then passed after removal.
- Dependency audit: zero reported vulnerabilities at every severity.
- Client and server production builds and pinned local-voice setup pass.
- The initial local full suite passed 2,088 tests with 44 environment-dependent skips before the three retired test files were removed. The final suite with voice assets and the revised dependency graph, plus hosted CI with MySQL, are the release gates; see this change's PR checks for their final outcomes.

These are code-usage and regression checks, not proof of zero possible defects or improved audience engagement. Main was not deployed by this audit.
