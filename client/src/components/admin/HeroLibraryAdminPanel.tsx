/**
 * Hero image library admin.
 *
 * The weekly-edition cron picks from this pool (least-recently-used)
 * instead of burning an OpenAI image-gen call every Sunday. This panel
 * lets the editor:
 *
 *   - See every library cover with usage counts + last-used dates
 *   - Generate a new cover (single image at a time) to grow the library
 *   - Retire / restore covers without losing them
 *   - Delete covers that no longer fit the brand
 *
 * The library bootstraps itself: when it's empty, the cron generates a
 * fresh image AND seeds it here so the next edition can reuse it. Start
 * here, hit "Generate" 10-15 times, and the cost on subsequent editions
 * drops to near zero.
 */
import { useState } from "react";
import {
  Eye,
  EyeOff,
  ImagePlus,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function HeroLibraryAdminPanel() {
  const utils = trpc.useUtils();
  const listQuery = trpc.heroLibrary.list.useQuery();
  const items = listQuery.data ?? [];

  const generate = trpc.heroLibrary.generate.useMutation({
    onSuccess: () => {
      toast.success("New cover added to the library");
      utils.heroLibrary.list.invalidate();
    },
    onError: (err) =>
      toast.error(err.message ?? "Couldn't generate, check OPENAI_API_KEY"),
  });

  const setRetired = trpc.heroLibrary.setRetired.useMutation({
    onSuccess: () => utils.heroLibrary.list.invalidate(),
  });
  const setLabel = trpc.heroLibrary.setLabel.useMutation({
    onSuccess: () => utils.heroLibrary.list.invalidate(),
  });
  const remove = trpc.heroLibrary.remove.useMutation({
    onSuccess: () => {
      toast.success("Removed");
      utils.heroLibrary.list.invalidate();
    },
  });

  const active = items.filter((i) => !i.retired);
  const usedCount = items.reduce((acc, i) => acc + i.usedCount, 0);

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-6">
      <div>
        <p
          className="overline-amber mb-2"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          Hero library
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">
          Reusable edition covers
        </h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[64ch] leading-relaxed">
          The weekly cron picks from this pool least-recently-used first, so
          most editions cost zero OpenAI image calls. Aim for ~15-20 covers in
          rotation, each then only repeats every 3-5 months. Generate fresh
          covers when one no longer fits, retire the ones you&apos;re tired of.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => generate.mutate({})}
          disabled={generate.isPending}
          className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background:
              "var(--grad-cta-amber)",
            color: "var(--color-on-amber)",
            boxShadow: "0 4px 14px oklch(0.75 0.18 70 / 25%)",
          }}
        >
          <Sparkles className="h-3 w-3" />
          {generate.isPending ? "Generating…" : "Generate new cover"}
        </button>
        <p
          className="overline text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.18em" }}
        >
          {items.length === 0
            ? "Library empty"
            : `${active.length} active / ${items.length} total · ${usedCount} edition${usedCount === 1 ? "" : "s"} served`}
        </p>
      </div>

      {items.length === 0 ? (
        <div
          className="rounded p-6 text-center"
          style={{
            background: "oklch(1 0 0 / 2%)",
            boxShadow: "inset 0 0 0 1px var(--color-border)",
          }}
        >
          <ImagePlus className="h-8 w-8 mx-auto text-[var(--color-fg-subtle)] mb-3" />
          <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed max-w-[44ch] mx-auto">
            No covers yet. Hit <strong>Generate new cover</strong> 10-15 times
            to seed the library. Until then the cron falls back to fresh
            generation (and auto-seeds each result here).
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <HeroLibraryCard
              key={item.id}
              item={item}
              onToggleRetired={() =>
                setRetired.mutate({ id: item.id, retired: !item.retired })
              }
              onDelete={() => {
                if (confirm("Delete this cover from the library?"))
                  remove.mutate({ id: item.id });
              }}
              onRename={(label) => setLabel.mutate({ id: item.id, label })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

type LibraryItem = {
  id: number;
  url: string;
  label: string | null;
  retired: boolean;
  usedCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
};

function HeroLibraryCard({
  item,
  onToggleRetired,
  onDelete,
  onRename,
}: {
  item: LibraryItem;
  onToggleRetired: () => void;
  onDelete: () => void;
  onRename: (label: string | null) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(item.label ?? "");

  const lastUsed = item.lastUsedAt ? new Date(item.lastUsedAt) : null;
  const lastUsedLabel = lastUsed
    ? lastUsed.toLocaleDateString("en-AU", { day: "numeric", month: "short" })
    : "never used";

  return (
    <li
      className="rounded overflow-hidden flex flex-col"
      style={{
        background: "oklch(1 0 0 / 2%)",
        boxShadow: "inset 0 0 0 1px var(--color-border)",
        opacity: item.retired ? 0.55 : 1,
      }}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-[var(--color-bg-deep)]">
        <img
          src={item.url}
          alt={item.label ?? `Cover #${item.id}`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
        {item.retired && (
          <span
            className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-[0.18em]"
            style={{
              background: "oklch(0.10 0.018 260 / 80%)",
              color: "oklch(0.75 0.05 60)",
              boxShadow: "inset 0 0 0 1px oklch(0.55 0.04 60 / 50%)",
            }}
          >
            Retired
          </span>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-1.5 min-h-0">
        {renaming ? (
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            autoFocus
            maxLength={128}
            onBlur={() => {
              const next = draftLabel.trim() || null;
              if (next !== item.label) onRename(next);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraftLabel(item.label ?? "");
                setRenaming(false);
              }
            }}
            placeholder="Label (optional)"
            className="px-2 py-1 rounded text-xs bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/50 transition-colors"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="text-left text-xs text-[var(--color-fg)] hover:text-amber-200 transition-colors truncate flex items-center gap-1 group"
            title="Rename"
          >
            <span className="truncate">
              {item.label ?? <em className="text-[var(--color-fg-subtle)]">Untitled</em>}
            </span>
            <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </button>
        )}
        <p
          className="overline text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.14em", fontSize: "10px" }}
        >
          Used {item.usedCount}× · {lastUsedLabel}
        </p>
        <div className="flex items-center justify-end gap-1 -mr-1">
          <button
            onClick={onToggleRetired}
            aria-label={item.retired ? "Restore to rotation" : "Retire from rotation"}
            title={item.retired ? "Restore" : "Retire"}
            className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 hover:bg-white/5 transition-colors"
          >
            {item.retired ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete"
            title="Delete permanently"
            className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 hover:bg-white/5 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
