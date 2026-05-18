/**
 * Demo-mode query implementations. Same function names as the live db
 * helpers; each real helper checks isDemoMode() first and dispatches here.
 *
 * Writes mutate the in-memory store; the data resets on server restart.
 */
import type {
  DailyFeedItem,
  DailyMetric,
  Edition,
  FeaturedLinkedInPost,
  InsertDailyFeedItem,
  InsertEdition,
  InsertFeaturedLinkedInPost,
  InsertReadingQueueItem,
  InsertSubscriber,
  ReadingQueueItem,
  Subscriber,
} from "../db/schema";
import { allocId, demo, demoUser } from "./store";

// ─── Editions ───────────────────────────────────────────────────────────────

export function listEditions(): Edition[] {
  return [...demo.editions].sort((a, b) => b.editionNumber - a.editionNumber);
}

export function getEditionById(id: number): Edition | undefined {
  return demo.editions.find((e) => e.id === id);
}

export function getEditionByNumber(n: number): Edition | undefined {
  return demo.editions.find((e) => e.editionNumber === n);
}

export function createEdition(data: InsertEdition): void {
  const edition: Edition = {
    id: allocId(),
    editionNumber: data.editionNumber,
    weekOf: data.weekOf,
    weekRange: data.weekRange,
    publishedAt: new Date(),
    pdfUrl: data.pdfUrl ?? null,
    readingTime: data.readingTime ?? null,
    topics: data.topics,
    signals: data.signals,
    fullText: data.fullText ?? null,
    keyMetrics: data.keyMetrics ?? null,
    heroImageUrl: data.heroImageUrl ?? null,
    rubensTake: data.rubensTake ?? null,
    substackDraftTitle: data.substackDraftTitle ?? null,
    substackDraftSubtitle: data.substackDraftSubtitle ?? null,
    substackDraftBody: data.substackDraftBody ?? null,
    substackDraftImageUrl: data.substackDraftImageUrl ?? null,
    marketStress: data.marketStress ?? null,
    datesToWatch: data.datesToWatch ?? null,
    metaTitle: data.metaTitle ?? null,
    metaDescription: data.metaDescription ?? null,
    socialTitle: data.socialTitle ?? null,
    socialDescription: data.socialDescription ?? null,
    headlineVariants: data.headlineVariants ?? null,
    createdAt: new Date(),
  };
  demo.editions.unshift(edition);
}

export function updateRubensTake(id: number, rubensTake: string): void {
  const e = demo.editions.find((x) => x.id === id);
  if (e) e.rubensTake = rubensTake;
}

export function updateEditionSynthesis(
  id: number,
  patch: {
    topics?: Edition["topics"];
    signals?: Edition["signals"];
    fullText?: Edition["fullText"];
    keyMetrics?: Edition["keyMetrics"];
    marketStress?: Edition["marketStress"];
    datesToWatch?: Edition["datesToWatch"];
  }
): void {
  const e = demo.editions.find((x) => x.id === id);
  if (!e) return;
  if (patch.topics !== undefined) e.topics = patch.topics;
  if (patch.signals !== undefined) e.signals = patch.signals;
  if (patch.fullText !== undefined) e.fullText = patch.fullText;
  if (patch.keyMetrics !== undefined) e.keyMetrics = patch.keyMetrics;
  if (patch.marketStress !== undefined) e.marketStress = patch.marketStress;
  if (patch.datesToWatch !== undefined) e.datesToWatch = patch.datesToWatch;
}

export function updateEditionSeo(
  id: number,
  seo: {
    metaTitle: string;
    metaDescription: string;
    socialTitle: string;
    socialDescription: string;
    headlineVariants: string[];
  }
): void {
  const e = demo.editions.find((x) => x.id === id);
  if (!e) return;
  e.metaTitle = seo.metaTitle;
  e.metaDescription = seo.metaDescription;
  e.socialTitle = seo.socialTitle;
  e.socialDescription = seo.socialDescription;
  e.headlineVariants = seo.headlineVariants;
}

export function deleteEdition(id: number): void {
  const idx = demo.editions.findIndex((e) => e.id === id);
  if (idx >= 0) demo.editions.splice(idx, 1);
}

export function updateSubstackDraft(
  id: number,
  draft: { title: string; subtitle: string; body: string; imageUrl?: string | null }
): void {
  const e = demo.editions.find((x) => x.id === id);
  if (!e) return;
  e.substackDraftTitle = draft.title;
  e.substackDraftSubtitle = draft.subtitle;
  e.substackDraftBody = draft.body;
  if (draft.imageUrl !== undefined) e.substackDraftImageUrl = draft.imageUrl;
}

export function updateSubstackImage(id: number, imageUrl: string | null): void {
  const e = demo.editions.find((x) => x.id === id);
  if (e) e.substackDraftImageUrl = imageUrl;
}

export function updateHeroImage(id: number, heroImageUrl: string): void {
  const e = demo.editions.find((x) => x.id === id);
  if (e) e.heroImageUrl = heroImageUrl;
}

export function searchEditionFullText(query: string): Edition[] {
  const q = query.toLowerCase();
  return demo.editions.filter(
    (e) =>
      (e.fullText ?? "").toLowerCase().includes(q) ||
      e.weekOf.toLowerCase().includes(q) ||
      e.weekRange.toLowerCase().includes(q)
  );
}

export function getEditionsByCategory(category: string): Edition[] {
  const cat = category.toUpperCase();
  return demo.editions.filter((e) =>
    (e.topics ?? []).some((t) => (t.category ?? "").toUpperCase() === cat)
  );
}

export function getRecentEditionsForMetrics(limit: number) {
  return listEditions()
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      editionNumber: e.editionNumber,
      weekOf: e.weekOf,
      weekRange: e.weekRange,
      keyMetrics: e.keyMetrics,
      publishedAt: e.publishedAt,
    }));
}

export function getMetricHistory(limit: number) {
  return listEditions()
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      editionNumber: e.editionNumber,
      weekOf: e.weekOf,
      weekRange: e.weekRange,
      publishedAt: e.publishedAt,
      keyMetrics: e.keyMetrics,
    }))
    .reverse();
}

export function getSignalFrequency(limit: number) {
  return listEditions()
    .slice(0, limit)
    .reverse()
    .map((row) => {
      const counts: Record<string, number> = {};
      for (const t of row.topics ?? []) {
        const cat = (t.category || "OTHER").toUpperCase();
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
      return {
        editionNumber: row.editionNumber,
        weekOf: row.weekOf,
        categoryCounts: counts,
        signalCount: (row.signals ?? []).length,
        topicCount: (row.topics ?? []).length,
      };
    });
}

// ─── Daily feed ─────────────────────────────────────────────────────────────

function byPriorityThenRecent(a: DailyFeedItem, b: DailyFeedItem): number {
  const dp = (b.priority ?? 50) - (a.priority ?? 50);
  if (dp !== 0) return dp;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export function listFeedItems(date?: string): DailyFeedItem[] {
  if (date) {
    return [...demo.feed]
      .filter((i) => i.feedDate === date)
      .sort(byPriorityThenRecent);
  }
  return [...demo.feed].sort(byPriorityThenRecent).slice(0, 30);
}

export function getFeedItemById(id: number): DailyFeedItem | undefined {
  return demo.feed.find((i) => i.id === id);
}

export function getFeedItemsByIds(ids: number[]): DailyFeedItem[] {
  const set = new Set(ids);
  return demo.feed.filter((i) => set.has(i.id));
}

export function listArchive(opts: {
  category?: string;
  limit: number;
  offset: number;
}): DailyFeedItem[] {
  let items = [...demo.feed];
  if (opts.category) {
    const cat = opts.category.toUpperCase();
    items = items.filter((i) => i.category.toUpperCase() === cat);
  }
  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items.slice(opts.offset, opts.offset + opts.limit);
}

export function getRecentFeedDates(limit: number): string[] {
  const set = new Set<string>();
  for (const item of [...demo.feed].sort((a, b) => b.feedDate.localeCompare(a.feedDate))) {
    set.add(item.feedDate);
    if (set.size >= limit) break;
  }
  return [...set];
}

export function createFeedItems(items: InsertDailyFeedItem[]): void {
  for (const item of items) {
    demo.feed.unshift({
      id: allocId(),
      feedDate: item.feedDate,
      title: item.title,
      source: item.source,
      sourceUrl: item.sourceUrl ?? null,
      summary: item.summary,
      category: item.category,
      imageUrl: item.imageUrl ?? null,
      partnerTag: item.partnerTag ?? null,
      sayThis: item.sayThis ?? null,
      rubensNote: item.rubensNote ?? null,
      priority: item.priority ?? 50,
      promotedToEdition: false,
      createdAt: new Date(),
    });
  }
}

export function updateFeedItemPartnerTag(id: number, partnerTag: string): void {
  const item = demo.feed.find((i) => i.id === id);
  if (item) item.partnerTag = partnerTag;
}

export function deleteFeedItem(id: number): void {
  const idx = demo.feed.findIndex((i) => i.id === id);
  if (idx >= 0) demo.feed.splice(idx, 1);
}

export function updateFeedItemSayThis(id: number, sayThis: string): void {
  const item = demo.feed.find((i) => i.id === id);
  if (item) item.sayThis = sayThis;
}

export function updateFeedItemRubensNote(id: number, rubensNote: string | null): void {
  const item = demo.feed.find((i) => i.id === id);
  if (item) item.rubensNote = rubensNote;
}

export function updateFeedItemPriority(id: number, priority: number): void {
  const item = demo.feed.find((i) => i.id === id);
  if (item) item.priority = priority;
}

export function updateFeedItemImageUrl(id: number, imageUrl: string): void {
  const item = demo.feed.find((i) => i.id === id);
  if (item) item.imageUrl = imageUrl;
}

export function listFeedItemsBetween(startDate: string, endDate: string): DailyFeedItem[] {
  return [...demo.feed]
    .filter((i) => i.feedDate >= startDate && i.feedDate <= endDate)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function listFeedItemsMissingSayThis(limit: number): DailyFeedItem[] {
  return [...demo.feed]
    .filter((i) => !i.sayThis || i.sayThis.trim().length === 0)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export function getFeedItemsByCategory(category: string, limit: number): DailyFeedItem[] {
  const cat = category.toUpperCase();
  return [...demo.feed]
    .filter((i) => (i.category ?? "").toUpperCase() === cat)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export function listAllCategories(): string[] {
  const set = new Set<string>();
  for (const item of demo.feed) set.add(item.category.toUpperCase());
  for (const edition of demo.editions) {
    for (const t of edition.topics ?? []) set.add((t.category ?? "OTHER").toUpperCase());
  }
  return [...set].sort();
}

export function getCategoryHeat(days: number) {
  const cutoff = new Date(Date.now() - days * 86400000);
  const counts: Record<string, { daily: number; weekly: number; total: number }> = {};

  for (const item of demo.feed) {
    if (item.createdAt < cutoff) continue;
    const cat = item.category.toUpperCase();
    counts[cat] ??= { daily: 0, weekly: 0, total: 0 };
    counts[cat].daily++;
    counts[cat].total++;
  }
  for (const edition of demo.editions) {
    if (edition.publishedAt < cutoff) continue;
    for (const t of edition.topics ?? []) {
      const cat = (t.category ?? "OTHER").toUpperCase();
      counts[cat] ??= { daily: 0, weekly: 0, total: 0 };
      counts[cat].weekly++;
      counts[cat].total++;
    }
  }
  return Object.entries(counts)
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);
}

export function searchAllContent(query: string) {
  const q = query.toLowerCase();
  return {
    editions: demo.editions.filter(
      (e) =>
        (e.fullText ?? "").toLowerCase().includes(q) ||
        e.weekRange.toLowerCase().includes(q) ||
        e.weekOf.toLowerCase().includes(q) ||
        (e.topics ?? []).some(
          (t) =>
            (t.title ?? "").toLowerCase().includes(q) ||
            (t.summary ?? "").toLowerCase().includes(q)
        )
    ),
    feedItems: demo.feed.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.summary.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    ),
  };
}

// ─── Reading queue ──────────────────────────────────────────────────────────

export function getEnrichedQueue(userId: number) {
  return demo.queue
    .filter((q) => q.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((q) => {
      const feed = q.feedItemId ? demo.feed.find((f) => f.id === q.feedItemId) : null;
      return {
        ...q,
        feedTitle: feed?.title ?? null,
        feedSummary: feed?.summary ?? null,
        feedCategory: feed?.category ?? null,
        feedSource: feed?.source ?? null,
        feedSourceUrl: feed?.sourceUrl ?? null,
        feedDate: feed?.feedDate ?? null,
      };
    });
}

export function addToQueue(data: InsertReadingQueueItem): ReadingQueueItem {
  const item: ReadingQueueItem = {
    id: allocId(),
    userId: data.userId,
    feedItemId: data.feedItemId ?? null,
    customUrl: data.customUrl ?? null,
    customTitle: data.customTitle ?? null,
    articleText: data.articleText ?? null,
    isRead: false,
    createdAt: new Date(),
  };
  demo.queue.unshift(item);
  return item;
}

export function markQueueItemRead(id: number, userId: number): void {
  const item = demo.queue.find((q) => q.id === id && q.userId === userId);
  if (item) item.isRead = true;
}

export function removeFromQueue(id: number, userId: number): void {
  const idx = demo.queue.findIndex((q) => q.id === id && q.userId === userId);
  if (idx >= 0) demo.queue.splice(idx, 1);
}

export function clearQueue(userId: number): void {
  for (let i = demo.queue.length - 1; i >= 0; i--) {
    if (demo.queue[i]!.userId === userId) demo.queue.splice(i, 1);
  }
}

export function markAllQueueRead(userId: number): void {
  for (const item of demo.queue) if (item.userId === userId) item.isRead = true;
}

// ─── Feedback ───────────────────────────────────────────────────────────────

export function createFeedback(data: {
  kind: string;
  message: string;
  pageUrl?: string | null;
  userAgent?: string | null;
  contactEmail?: string | null;
  reporterLabel?: string | null;
}): void {
  demo.feedback.unshift({
    id: allocId(),
    kind: data.kind,
    message: data.message,
    pageUrl: data.pageUrl ?? null,
    userAgent: data.userAgent ?? null,
    contactEmail: data.contactEmail ?? null,
    reporterLabel: data.reporterLabel ?? null,
    status: "new",
    createdAt: new Date(),
  });
}

export function listFeedback() {
  return [...demo.feedback];
}

export function updateFeedbackStatus(id: number, status: "new" | "reviewed"): void {
  const row = demo.feedback.find((f) => f.id === id);
  if (row) row.status = status;
}

export function deleteFeedback(id: number): void {
  const idx = demo.feedback.findIndex((f) => f.id === id);
  if (idx >= 0) demo.feedback.splice(idx, 1);
}

export function countNewFeedback(): number {
  return demo.feedback.filter((f) => f.status === "new").length;
}

// ─── Users ──────────────────────────────────────────────────────────────────

export function upsertUser(): void {
  /* No-op in demo mode, the user is fixed. */
}

export function getUserByOpenId(openId: string) {
  if (openId === demoUser.openId) return demoUser;
  return undefined;
}

// ─── Subscribers ────────────────────────────────────────────────────────────

export function findSubscriberByEmail(email: string): Subscriber | undefined {
  return demo.subscribers.find((s) => s.email.toLowerCase() === email.toLowerCase());
}

export function findSubscriberByToken(token: string): Subscriber | undefined {
  return demo.subscribers.find((s) => s.confirmToken === token);
}

export function createSubscriber(data: InsertSubscriber): Subscriber {
  const existing = findSubscriberByEmail(data.email);
  if (existing) return existing;
  const sub: Subscriber = {
    id: allocId(),
    email: data.email,
    name: data.name ?? null,
    confirmToken: data.confirmToken ?? null,
    confirmedAt: data.confirmedAt ?? null,
    unsubscribedAt: null,
    source: data.source ?? null,
    isPremium: data.isPremium ?? false,
    createdAt: new Date(),
  };
  demo.subscribers.unshift(sub);
  return sub;
}

export function confirmSubscriber(token: string): Subscriber | undefined {
  const row = findSubscriberByToken(token);
  if (!row) return undefined;
  row.confirmedAt = new Date();
  row.confirmToken = null;
  return row;
}

export function unsubscribeByEmail(email: string): void {
  const row = findSubscriberByEmail(email);
  if (row) row.unsubscribedAt = new Date();
}

export function listSubscribers(): Subscriber[] {
  return [...demo.subscribers].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export function countConfirmedSubscribers(): number {
  return demo.subscribers.filter((s) => s.confirmedAt && !s.unsubscribedAt).length;
}

// ─── Featured LinkedIn posts ────────────────────────────────────────────────

export function listLiveLinkedInPosts(limit: number): FeaturedLinkedInPost[] {
  return [...demo.linkedInPosts]
    .filter((p) => p.isLive)
    .sort((a, b) => a.displayOrder - b.displayOrder || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export function listAllLinkedInPosts(): FeaturedLinkedInPost[] {
  return [...demo.linkedInPosts].sort(
    (a, b) => a.displayOrder - b.displayOrder || b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export function createLinkedInPost(data: InsertFeaturedLinkedInPost): FeaturedLinkedInPost {
  const post: FeaturedLinkedInPost = {
    id: allocId(),
    postUrl: data.postUrl,
    excerpt: data.excerpt,
    authorName: data.authorName ?? "Ruben Laubscher",
    displayOrder: data.displayOrder ?? 100,
    isLive: data.isLive ?? true,
    createdAt: new Date(),
  };
  demo.linkedInPosts.unshift(post);
  return post;
}

export function updateLinkedInPost(
  id: number,
  patch: Partial<Omit<InsertFeaturedLinkedInPost, "id">>
): void {
  const row = demo.linkedInPosts.find((p) => p.id === id);
  if (!row) return;
  if (patch.postUrl !== undefined) row.postUrl = patch.postUrl;
  if (patch.excerpt !== undefined) row.excerpt = patch.excerpt;
  if (patch.authorName !== undefined && patch.authorName !== null) row.authorName = patch.authorName;
  if (patch.displayOrder !== undefined && patch.displayOrder !== null) row.displayOrder = patch.displayOrder;
  if (patch.isLive !== undefined && patch.isLive !== null) row.isLive = patch.isLive;
}

export function deleteLinkedInPost(id: number): void {
  const idx = demo.linkedInPosts.findIndex((p) => p.id === id);
  if (idx >= 0) demo.linkedInPosts.splice(idx, 1);
}

// ─── Daily metrics ──────────────────────────────────────────────────────────

export function listDailyMetrics(): DailyMetric[] {
  return [...demo.metrics].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function upsertDailyMetric(input: {
  metricKey: string;
  label: string;
  value: string;
  unit?: string | null;
  source?: string | null;
  context?: string | null;
  groupKey?: string | null;
  sourceUrl?: string | null;
  asOf: Date;
  displayOrder?: number;
}): void {
  const existing = demo.metrics.find((m) => m.metricKey === input.metricKey);
  const previousValue = existing?.value ?? null;
  if (existing) {
    existing.label = input.label;
    existing.value = input.value;
    existing.unit = input.unit ?? null;
    existing.source = input.source ?? null;
    existing.context = input.context ?? null;
    existing.groupKey = input.groupKey ?? null;
    existing.sourceUrl = input.sourceUrl ?? null;
    existing.asOf = input.asOf;
    existing.displayOrder = input.displayOrder ?? existing.displayOrder;
    existing.previousValue = previousValue;
    existing.updatedAt = new Date();
    return;
  }
  demo.metrics.push({
    id: allocId(),
    metricKey: input.metricKey,
    label: input.label,
    value: input.value,
    unit: input.unit ?? null,
    source: input.source ?? null,
    context: input.context ?? null,
    groupKey: input.groupKey ?? null,
    sourceUrl: input.sourceUrl ?? null,
    asOf: input.asOf,
    displayOrder: input.displayOrder ?? 100,
    previousValue,
    updatedAt: new Date(),
  });
}

/**
 * Edition asset demo stubs, no-op stores so the demo console doesn't
 * error when image generation runs, and a null fetcher so the Express
 * route returns 404 in demo mode (the SVG fallback renders client-side).
 */
export function storeEditionAsset(_args: {
  editionId: number;
  kind: string;
  contentType: string;
  bytes: Buffer;
}): number {
  return 0;
}

export function getLatestEditionAsset(
  _editionId: number,
  _kind: string
): null {
  return null;
}

/**
 * Hero-library demo stubs, empty list, null picks, no-op writes. Demo
 * mode skips image generation entirely so the library never gets
 * populated, and these stubs make sure the routers/cron don't error.
 */
export function listHeroLibrary(): [] {
  return [];
}

export function pickLeastRecentlyUsedHero(): null {
  return null;
}

export function getHeroLibraryBytes(_id: number): null {
  return null;
}

export function storeHeroLibraryItem(_args: {
  label?: string | null;
  promptUsed?: string | null;
  contentType: string;
  bytes: Buffer;
}): number {
  return 0;
}

export function markHeroLibraryUsed(_id: number): void {}

export function setHeroLibraryRetired(_id: number, _retired: boolean): void {}

export function setHeroLibraryLabel(_id: number, _label: string | null): void {}

export function deleteHeroLibraryItem(_id: number): void {}

/**
 * Demo-mode history. Generates a smooth-ish 30-day series around the
 * current value so the sparklines have something to render even with no
 * real DB writes yet. Deterministic per metricKey so the chart doesn't
 * flicker between renders.
 */
export function listMetricHistories(
  days = 30
): Record<string, Array<{ value: number; recordedAt: Date }>> {
  const out: Record<string, Array<{ value: number; recordedAt: Date }>> = {};
  for (const m of demo.metrics) {
    const cleaned = m.value.replace(/[$,%\s]/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n)) continue;
    // Cheap hash-driven walk so each metric gets a stable shape.
    let seed = 0;
    for (let i = 0; i < m.metricKey.length; i++) {
      seed = (seed * 31 + m.metricKey.charCodeAt(i)) >>> 0;
    }
    const series: Array<{ value: number; recordedAt: Date }> = [];
    let v = n * 0.95;
    for (let i = 0; i < days; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const wobble = ((seed % 1000) / 1000 - 0.5) * 0.04 * n;
      v = v + wobble + (n - v) * 0.05;
      series.push({
        value: v,
        recordedAt: new Date(Date.now() - (days - i) * 86_400_000),
      });
    }
    series.push({ value: n, recordedAt: new Date() });
    out[m.metricKey] = series;
  }
  return out;
}
