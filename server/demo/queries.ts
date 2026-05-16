/**
 * Demo-mode query implementations. Same function names as the live db
 * helpers; each real helper checks isDemoMode() first and dispatches here.
 *
 * Writes mutate the in-memory store; the data resets on server restart.
 */
import type {
  ConversationEntry,
  DailyFeedItem,
  DailyMetric,
  Edition,
  FeaturedLinkedInPost,
  InsertConversationEntry,
  InsertDailyFeedItem,
  InsertEdition,
  InsertFeaturedLinkedInPost,
  InsertReadingQueueItem,
  InsertSubscriber,
  InsertWeeklyNote,
  ReadingQueueItem,
  Subscriber,
  WeeklyNote,
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
    createdAt: new Date(),
  };
  demo.editions.unshift(edition);
}

export function updateRubensTake(id: number, rubensTake: string): void {
  const e = demo.editions.find((x) => x.id === id);
  if (e) e.rubensTake = rubensTake;
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

export function listFeedItems(date?: string): DailyFeedItem[] {
  if (date) {
    return [...demo.feed]
      .filter((i) => i.feedDate === date)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return [...demo.feed]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 30);
}

export function getFeedItemById(id: number): DailyFeedItem | undefined {
  return demo.feed.find((i) => i.id === id);
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

// ─── Notes ──────────────────────────────────────────────────────────────────

export function getNote(userId: number, weekId: string): WeeklyNote | undefined {
  return demo.notes.find((n) => n.userId === userId && n.weekId === weekId);
}

export function listNotes(userId: number): WeeklyNote[] {
  return [...demo.notes]
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.weekId.localeCompare(a.weekId));
}

export function upsertNote(data: InsertWeeklyNote): void {
  const existing = demo.notes.find((n) => n.userId === data.userId && n.weekId === data.weekId);
  if (existing) {
    existing.content = data.content;
    existing.updatedAt = new Date();
    return;
  }
  demo.notes.push({
    id: allocId(),
    userId: data.userId,
    weekId: data.weekId,
    content: data.content,
    updatedAt: new Date(),
    createdAt: new Date(),
  });
}

export function deleteNote(userId: number, weekId: string): void {
  const idx = demo.notes.findIndex((n) => n.userId === userId && n.weekId === weekId);
  if (idx >= 0) demo.notes.splice(idx, 1);
}

// ─── Conversations ──────────────────────────────────────────────────────────

export function listConversationEntries(userId: number): ConversationEntry[] {
  return [...demo.conversations]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.usedAt.getTime() - a.usedAt.getTime());
}

export function addConversationEntry(data: InsertConversationEntry): void {
  demo.conversations.unshift({
    id: allocId(),
    userId: data.userId,
    editionId: data.editionId ?? null,
    lineText: data.lineText,
    usedWithCategory: data.usedWithCategory ?? null,
    usedAt: new Date(),
  });
}

// ─── Users ──────────────────────────────────────────────────────────────────

export function upsertUser(): void {
  /* No-op in demo mode — the user is fixed. */
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
    asOf: input.asOf,
    displayOrder: input.displayOrder ?? 100,
    previousValue,
    updatedAt: new Date(),
  });
}
