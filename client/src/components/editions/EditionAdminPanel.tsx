/**
 * Admin actions for an EditionReader: regenerate Ruben's Take, generate a
 * full Substack draft, regenerate the Substack hero image without rewriting
 * the essay (improvement #7), and persist hand-edits.
 *
 * Only renders for users with role === "admin".
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ClipboardCopy,
  Image as ImageIcon,
  PenSquare,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import type { Edition } from "@shared/types";
import { LINKEDIN_LIMITS } from "@shared/const";
import { Button } from "../ui/Button";
import { LinkedInPostModal } from "../LinkedInPostModal";
import { SectionErrorBoundary } from "../ErrorBoundary";
import { SITE_DISPLAY } from "@/lib/siteUrl";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

export function EditionAdminPanel({ edition }: { edition: Edition }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return null;
  return (
    <section className="panel rounded p-6 mt-12">
      <header className="mb-5">
        <p className="overline mb-1">Admin panel</p>
        <h2 className="font-serif text-xl">Workshop this edition</h2>
        <p className="text-xs text-[var(--color-fg-muted)] mt-1">
          Only visible to admins. All actions are reversible.
        </p>
      </header>
      <SectionErrorBoundary section="Take controls">
        <TakeControls edition={edition} />
      </SectionErrorBoundary>
      <SectionErrorBoundary section="Hero image controls">
        <HeroImageControls edition={edition} />
      </SectionErrorBoundary>
      <SectionErrorBoundary section="Forward this">
        <ForwardEdition edition={edition} />
      </SectionErrorBoundary>
      <SectionErrorBoundary section="Substack draft">
        <SubstackDraftEditor edition={edition} />
      </SectionErrorBoundary>
      <SectionErrorBoundary section="Danger zone">
        <DeleteEditionButton edition={edition} />
      </SectionErrorBoundary>
    </section>
  );
}

// ─── Delete edition (destructive, admin only) ──────────────────────────────

function DeleteEditionButton({ edition }: { edition: Edition }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const del = trpc.editions.deleteEdition.useMutation({
    onSuccess: () => {
      toast.success(`Edition ${edition.editionNumber} deleted`);
      utils.editions.list.invalidate();
      navigate("/editions");
    },
    onError: (err) => toast.error(err.message || "Couldn't delete"),
  });
  function onClick() {
    const ok = confirm(
      `Delete edition ${edition.editionNumber} (${edition.weekRange})? This frees up the slot so you can re-run weekly synthesis for that week.`
    );
    if (ok) del.mutate({ editionId: edition.id });
  }
  return (
    <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
      <p className="overline mb-2 text-red-300/70">Danger zone</p>
      <p className="text-xs text-[var(--color-fg-muted)] mb-3 max-w-[60ch]">
        Permanently removes this edition. Use to clear a thin first-pass before
        re-running weekly synthesis for the same week.
      </p>
      <button
        onClick={onClick}
        disabled={del.isPending}
        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] transition-colors border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
      >
        {del.isPending ? "Deleting…" : "Delete this edition"}
      </button>
    </div>
  );
}

// ─── Forward this edition by email ──────────────────────────────────────────

function ForwardEdition({ edition }: { edition: Edition }) {
  function openComposer() {
    const url =
      typeof window === "undefined"
        ? `/editions/${edition.editionNumber}`
        : `${window.location.origin}/editions/${edition.editionNumber}`;
    const subject = `The Desk · Edition ${edition.editionNumber} · ${edition.weekRange}`;
    const take = edition.rubensTake ? `\n\n"${edition.rubensTake}"\n· Ruben` : "";
    const body =
      `Thought you'd find this week's edition useful.${take}\n\n` +
      `Read it here: ${url}\n\n` +
      `If it lands, subscribe, Ruben writes two of these a week:\n` +
      `https://rubenlaubscher.substack.com/`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  return (
    <div className="border-t border-[var(--color-border)] pt-5 mt-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="overline mb-1">Forward this edition</p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            Opens your default mail client with a pre-filled subject, Ruben's Take, the edition link, and a Subscribe nudge.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openComposer}>
          <Send className="h-3.5 w-3.5" /> Forward
        </Button>
      </div>
    </div>
  );
}

// ─── Ruben's Take ───────────────────────────────────────────────────────────

function HeroImageControls({ edition }: { edition: Edition }) {
  const utils = trpc.useUtils();
  const generate = trpc.editions.generateHeroImage.useMutation({
    onSuccess: () => {
      utils.editions.getById.invalidate({ editionId: edition.id });
      utils.editions.getByNumber.invalidate({ editionNumber: edition.editionNumber });
      utils.editions.list.invalidate();
      toast.success("Hero image regenerated");
    },
    onError: (err) => toast.error(`Image generation failed: ${err.message}`),
  });

  return (
    <div className="border-t border-[var(--color-border)] pt-5 mt-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <p className="overline mb-1">Hero image</p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {edition.heroImageUrl
              ? "Cover is in place. Regenerate to try a different look."
              : "Missing. Generate a cover for this edition."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generate.mutate({ editionId: edition.id })}
          disabled={generate.isPending}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {generate.isPending
            ? "Generating..."
            : edition.heroImageUrl
              ? "Regenerate image"
              : "Generate image"}
        </Button>
      </div>
    </div>
  );
}

function TakeControls({ edition }: { edition: Edition }) {
  const utils = trpc.useUtils();
  const generate = trpc.editions.generateRubensTake.useMutation({
    onSuccess: () => {
      utils.editions.getById.invalidate({ editionId: edition.id });
      utils.editions.getByNumber.invalidate({ editionNumber: edition.editionNumber });
      utils.editions.list.invalidate();
      toast.success("Ruben's Take regenerated");
    },
    onError: (err) => toast.error(`Take generation failed: ${err.message}`),
  });

  return (
    <div className="border-t border-[var(--color-border)] pt-5 mt-5 first:pt-0 first:mt-0 first:border-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="overline mb-1">Ruben's Take</p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {edition.rubensTake ? "Take is in place. Regenerate to try a different angle." : "Not yet written."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generate.mutate({ editionId: edition.id })}
          disabled={generate.isPending}
        >
          <Wand2 className="h-3.5 w-3.5" />
          {generate.isPending ? "Generating..." : edition.rubensTake ? "Regenerate" : "Generate"}
        </Button>
      </div>
    </div>
  );
}

// ─── Substack draft ─────────────────────────────────────────────────────────

function SubstackDraftEditor({ edition }: { edition: Edition }) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(edition.substackDraftTitle ?? "");
  const [subtitle, setSubtitle] = useState(edition.substackDraftSubtitle ?? "");
  const [body, setBody] = useState(edition.substackDraftBody ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(edition.substackDraftImageUrl ?? null);
  const [linkedInOpen, setLinkedInOpen] = useState(false);

  // Keep local state in sync when the edition data refreshes.
  useEffect(() => {
    setTitle(edition.substackDraftTitle ?? "");
    setSubtitle(edition.substackDraftSubtitle ?? "");
    setBody(edition.substackDraftBody ?? "");
    setImageUrl(edition.substackDraftImageUrl ?? null);
  }, [
    edition.substackDraftTitle,
    edition.substackDraftSubtitle,
    edition.substackDraftBody,
    edition.substackDraftImageUrl,
  ]);

  const generate = trpc.editions.generateSubstackDraft.useMutation({
    onSuccess: (draft) => {
      setTitle(draft.title);
      setSubtitle(draft.subtitle);
      setBody(draft.body);
      setImageUrl(draft.imageUrl);
      utils.editions.list.invalidate();
      utils.editions.getById.invalidate({ editionId: edition.id });
      toast.success("Substack draft generated");
    },
    onError: (err) => toast.error(`Draft generation failed: ${err.message}`),
  });

  const regenerateImage = trpc.editions.regenerateSubstackImage.useMutation({
    onSuccess: ({ imageUrl: url }) => {
      setImageUrl(url);
      utils.editions.list.invalidate();
      utils.editions.getById.invalidate({ editionId: edition.id });
      toast.success("Hero image regenerated");
    },
    onError: (err) => toast.error(`Image regeneration failed: ${err.message}`),
  });

  const save = trpc.editions.saveSubstackDraft.useMutation({
    onSuccess: () => {
      utils.editions.list.invalidate();
      utils.editions.getById.invalidate({ editionId: edition.id });
      toast.success("Draft saved");
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const hasDraft = body.trim().length > 0;
  const bodyLength = body.length;
  const isOverLinkedIn = bodyLength > LINKEDIN_LIMITS.max;

  function handleSave() {
    if (!title.trim() || !subtitle.trim() || !body.trim()) {
      toast.error("Title, subtitle and body are required");
      return;
    }
    save.mutate({
      editionId: edition.id,
      title: title.trim(),
      subtitle: subtitle.trim(),
      body: body.trim(),
      imageUrl,
    });
  }

  return (
    <div className="border-t border-[var(--color-border)] pt-5 mt-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="overline mb-1">Substack draft</p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {hasDraft ? "Draft loaded, edit and save below." : "No draft yet."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasDraft && (
            <>
              {/* Regenerate image only, improvement #7 in the brief. */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerateImage.mutate({ editionId: edition.id })}
                disabled={regenerateImage.isPending}
                title="Regenerate just the hero image"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {regenerateImage.isPending ? "Generating..." : "Regen image"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLinkedInOpen(true)}
                title="Share draft as a LinkedIn post"
              >
                <PenSquare className="h-3.5 w-3.5" /> LinkedIn
              </Button>
              <CopyForSubstackButton
                title={title}
                subtitle={subtitle}
                body={body}
              />
            </>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => generate.mutate({ editionId: edition.id })}
            disabled={generate.isPending}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {generate.isPending ? "Generating..." : hasDraft ? "Regenerate" : "Generate"}
          </Button>
        </div>
      </div>

      {hasDraft && (
        <div className="space-y-3">
          {imageUrl && (
            <div className="aspect-[2/1] w-full overflow-hidden rounded bg-black/30">
              <img src={imageUrl} alt="Draft hero" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-black/20 border border-[var(--color-border)] rounded p-2.5 font-serif text-lg focus:outline-none focus:border-amber-500/50"
          />
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Subtitle"
            className="w-full bg-black/20 border border-[var(--color-border)] rounded p-2.5 text-sm text-[var(--color-fg-muted)] focus:outline-none focus:border-amber-500/50"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Essay body"
            rows={14}
            className="w-full bg-black/20 border border-[var(--color-border)] rounded p-3 text-sm font-sans resize-y leading-relaxed focus:outline-none focus:border-amber-500/50"
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p
              className={`font-mono text-xs ${
                isOverLinkedIn ? "text-red-400" : "text-[var(--color-fg-muted)]"
              }`}
            >
              {bodyLength.toLocaleString()} chars
            </p>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={save.isPending}>
              <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving..." : "Save draft"}
            </Button>
          </div>
        </div>
      )}

      {hasDraft && (
        <LinkedInPostModal
          open={linkedInOpen}
          onOpenChange={setLinkedInOpen}
          initialText={buildLinkedInDraftFromEssay({ title, subtitle, body })}
          heading="Share draft as a LinkedIn post"
        />
      )}
    </div>
  );
}

function buildLinkedInDraftFromEssay({
  title,
  subtitle,
  body,
}: {
  title: string;
  subtitle: string;
  body: string;
}): string {
  // Pull the first 2-3 paragraphs as a teaser. The full essay belongs on Substack.
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const teaser = paragraphs.slice(0, 2).join("\n\n");
  return [`${title}`, subtitle, "", teaser, "", `Via The Desk · ${SITE_DISPLAY}`]
    .join("\n")
    .trim();
}

// ─── Bulk action that lives at the Editions list level too ──────────────────

export function BackfillRubensTakeButton() {
  const utils = trpc.useUtils();
  const backfill = trpc.editions.backfillRubensTake.useMutation({
    onSuccess: ({ processed, results }) => {
      const ok = results.filter((r) => r.success).length;
      utils.editions.list.invalidate();
      toast.success(`Backfilled ${ok}/${processed} editions`);
    },
    onError: (err) => toast.error(`Backfill failed: ${err.message}`),
  });
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => backfill.mutate()}
      disabled={backfill.isPending}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${backfill.isPending ? "animate-spin" : ""}`} />
      {backfill.isPending ? "Backfilling..." : "Backfill Takes"}
    </Button>
  );
}

/**
 * Copy the Substack draft (title + subtitle + body) to the clipboard in a
 * paste-friendly format. Substack's editor handles paragraph breaks
 * cleanly when you paste plain text with double-newlines between
 * paragraphs, so we ship that. No HTML, Substack's HTML paste is finicky.
 */
function CopyForSubstackButton({
  title,
  subtitle,
  body,
}: {
  title: string;
  subtitle: string;
  body: string;
}) {
  async function copy() {
    const payload = [title, subtitle, "", body]
      .filter(Boolean)
      .map((s) => s.trim())
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Draft copied, paste into Substack");
    } catch {
      toast.error("Clipboard write failed");
    }
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={copy}
      title="Copy title + subtitle + body to clipboard, ready to paste into Substack"
    >
      <ClipboardCopy className="h-3.5 w-3.5" /> Copy
    </Button>
  );
}
