/**
 * Reader settings — theme, topic interest filters, notification stubs,
 * and account actions. Everything except theme persists to localStorage
 * via the UserPrefsProvider; theme has its own ThemeProvider.
 *
 * Visible to anyone (no auth wall). When real subscriber accounts arrive
 * the prefs will migrate to a server-side subscribers.prefs JSON column
 * — the shape is already JSON-friendly.
 */
import { useState } from "react";
import {
  Bell,
  Check,
  Layers,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { categoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/useAuth";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useTheme } from "@/lib/theme";
import {
  SELECTABLE_CATEGORIES,
  useUserPrefs,
  type NotificationPrefs,
} from "@/lib/userPrefs";

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const { isAuthenticated } = useAuth();
  return (
    <div className="space-y-10 max-w-3xl mx-auto pb-12">
      <PageHeader
        overline="The Desk · Settings"
        title="Preferences"
        kicker="How the brief looks, what lands in it, and when it pings you."
      />

      <SectionErrorBoundary section="Appearance">
        <AppearanceCard />
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Topics">
        <TopicsCard />
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Notifications">
        <NotificationsCard />
      </SectionErrorBoundary>

      {isAuthenticated && (
        <SectionErrorBoundary section="Account">
          <AccountCard />
        </SectionErrorBoundary>
      )}
    </div>
  );
}

// ─── Appearance ─────────────────────────────────────────────────────────────

function AppearanceCard() {
  const { theme, setTheme, systemPreferred, readingSize, setReadingSize } = useTheme();
  return (
    <SettingsCard
      icon={Monitor}
      title="Appearance"
      kicker="Dark by default — the brief reads as a print broadsheet at night. Light is for daylight desks."
    >
      <ThemeSegmented current={theme} onChange={setTheme} systemPreferred={systemPreferred} />
      <div className="mt-7 pt-6 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-4">
          <Type className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
          <p
            className="font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)]"
            style={{ fontSize: "11px" }}
          >
            Reading size
          </p>
        </div>
        <ReadingSizeSegmented current={readingSize} onChange={setReadingSize} />
      </div>
    </SettingsCard>
  );
}

function ReadingSizeSegmented({
  current,
  onChange,
}: {
  current: "default" | "comfortable";
  onChange: (s: "default" | "comfortable") => void;
}) {
  const options: Array<{
    key: "default" | "comfortable";
    label: string;
    sub: string;
  }> = [
    { key: "default", label: "Default", sub: "Brand-spec broadsheet register" },
    { key: "comfortable", label: "Comfortable", sub: "Body and overlines lift ~12.5%" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((opt) => {
        const active = current === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className={cn(
              "panel rounded-sm p-4 text-left transition-all",
              active && "ring-1 ring-amber-400/60"
            )}
            style={
              active
                ? {
                    background: "oklch(0.78 0.18 70 / 10%)",
                    boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 50%)",
                  }
                : undefined
            }
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="font-mono uppercase tracking-[0.16em]"
                style={{
                  color: active ? "var(--color-amber)" : "var(--color-fg)",
                  fontSize: opt.key === "comfortable" ? "12px" : "10px",
                }}
              >
                {opt.label}
              </span>
              {active && <Check className="h-3 w-3 ml-auto text-amber-300" />}
            </div>
            <p
              className="text-[var(--color-fg-subtle)] leading-relaxed"
              style={{ fontSize: opt.key === "comfortable" ? "13px" : "11px" }}
            >
              {opt.sub}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function ThemeSegmented({
  current,
  onChange,
  systemPreferred,
}: {
  current: "dark" | "light" | "system";
  onChange: (t: "dark" | "light" | "system") => void;
  systemPreferred: "dark" | "light";
}) {
  const options: Array<{
    key: "dark" | "light" | "system";
    label: string;
    sub: string;
    icon: typeof Moon;
  }> = [
    { key: "dark", label: "Dark", sub: "Editorial default", icon: Moon },
    { key: "light", label: "Light", sub: "Daylight desk", icon: Sun },
    {
      key: "system",
      label: "System",
      sub: `Follow OS · currently ${systemPreferred}`,
      icon: Monitor,
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = current === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className={cn(
              "panel rounded-sm p-4 text-left transition-all",
              active && "ring-1 ring-amber-400/60"
            )}
            style={
              active
                ? {
                    background: "oklch(0.78 0.18 70 / 10%)",
                    boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 50%)",
                  }
                : undefined
            }
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon
                className="h-3.5 w-3.5"
                style={{ color: active ? "var(--color-amber)" : "var(--color-fg-muted)" }}
              />
              <span
                className="font-mono uppercase tracking-[0.16em]"
                style={{
                  color: active ? "var(--color-amber)" : "var(--color-fg)",
                  fontSize: "10px",
                }}
              >
                {opt.label}
              </span>
              {active && <Check className="h-3 w-3 ml-auto text-amber-300" />}
            </div>
            <p className="text-[11px] text-[var(--color-fg-subtle)] leading-relaxed">
              {opt.sub}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Topics ─────────────────────────────────────────────────────────────────

function TopicsCard() {
  const { prefs, setTopicAllowlist } = useUserPrefs();
  function toggle(cat: string) {
    const current = new Set(prefs.topicAllowlist);
    if (current.has(cat)) current.delete(cat);
    else current.add(cat);
    setTopicAllowlist(Array.from(current));
  }
  const isAll = prefs.topicAllowlist.length === 0;

  return (
    <SettingsCard
      icon={Layers}
      title="Topics"
      kicker="Pick the beats you want surfaced. Leave them all off to see everything — the default."
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[var(--color-fg-subtle)] font-mono uppercase tracking-[0.14em]">
          {isAll
            ? "Showing all topics"
            : `Showing ${prefs.topicAllowlist.length} of ${SELECTABLE_CATEGORIES.length}`}
        </p>
        {!isAll && (
          <button
            onClick={() => setTopicAllowlist([])}
            className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--color-fg-muted)] hover:text-amber-300 transition-colors"
          >
            Reset (show all)
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SELECTABLE_CATEGORIES.map((cat) => {
          const active = prefs.topicAllowlist.includes(cat);
          const colour = categoryColour(cat);
          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              aria-pressed={active}
              className="rounded-sm p-3 transition-all text-left flex items-center gap-2"
              style={{
                background: active ? `${colour}15` : "oklch(1 0 0 / 2%)",
                boxShadow: active
                  ? `inset 0 0 0 1px ${colour}80`
                  : "inset 0 0 0 1px var(--color-border)",
              }}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  background: active ? colour : "transparent",
                  boxShadow: active ? `0 0 8px ${colour}` : `inset 0 0 0 1px ${colour}60`,
                }}
              />
              <span
                className="font-mono uppercase tracking-[0.14em] truncate"
                style={{
                  color: active ? colour : "var(--color-fg-muted)",
                  fontSize: "10px",
                }}
              >
                {cat}
              </span>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

// ─── Notifications ──────────────────────────────────────────────────────────

function NotificationsCard() {
  const { prefs, toggleNotification } = useUserPrefs();
  const rows: Array<{
    key: keyof NotificationPrefs;
    label: string;
    description: string;
  }> = [
    {
      key: "daily",
      label: "Daily brief",
      description: "Today's five stories at 7am AEST, Mon–Fri.",
    },
    {
      key: "weekly",
      label: "Weekly edition",
      description: "Sunday 7am AEST. Long-form, signals, dates to watch.",
    },
    {
      key: "breaking",
      label: "Breaking signal",
      description: "Mid-day pulse when a high-priority story lands.",
    },
  ];
  return (
    <SettingsCard
      icon={Bell}
      title="Notifications"
      kicker="Email delivery isn't wired up yet — these flags pre-stage your choice for when it goes live."
    >
      <ul className="space-y-3 mt-2">
        {rows.map((row) => {
          const on = prefs.notifications[row.key];
          return (
            <li
              key={row.key}
              className="panel rounded-sm p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed mt-0.5">
                  {row.description}
                </p>
              </div>
              <Toggle
                on={on}
                onChange={() => toggleNotification(row.key)}
                label={row.label}
              />
            </li>
          );
        })}
      </ul>
    </SettingsCard>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className="relative h-6 w-10 rounded-full transition-colors shrink-0"
      style={{
        background: on ? "oklch(0.78 0.18 70)" : "oklch(1 0 0 / 12%)",
        boxShadow: on
          ? "inset 0 0 0 1px oklch(0.78 0.18 70 / 60%), 0 0 12px oklch(0.78 0.18 70 / 30%)"
          : "inset 0 0 0 1px oklch(1 0 0 / 14%)",
      }}
    >
      <span
        className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform"
        style={{
          transform: on ? "translateX(16px)" : "translateX(0)",
          boxShadow: "0 1px 3px oklch(0 0 0 / 30%)",
        }}
      />
    </button>
  );
}

// ─── Account ────────────────────────────────────────────────────────────────

function AccountCard() {
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      toast.success("Signed out");
      navigate("/");
      // Hard reload to clear cached auth state.
      setTimeout(() => window.location.reload(), 150);
    } catch {
      toast.error("Couldn't sign out");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SettingsCard
      icon={LogOut}
      title="Account"
      kicker="The Desk has a single curator account today. Reader-level accounts arrive with email delivery."
    >
      <div className="flex flex-wrap items-center gap-3 mt-2">
        <button
          onClick={signOut}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
        >
          <LogOut className="h-3 w-3" />
          {busy ? "Signing out…" : "Sign out"}
        </button>
        <button
          onClick={() =>
            toast.message(
              "Reader-level account deletion arrives when email delivery does."
            )
          }
          className="inline-flex items-center gap-2 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors"
          style={{
            background: "oklch(0.68 0.20 15 / 8%)",
            color: "oklch(0.78 0.16 15)",
            boxShadow: "inset 0 0 0 1px oklch(0.68 0.20 15 / 30%)",
          }}
        >
          <Trash2 className="h-3 w-3" />
          Delete account
        </button>
      </div>
    </SettingsCard>
  );
}

// ─── Shared card chrome ─────────────────────────────────────────────────────

function SettingsCard({
  icon: Icon,
  title,
  kicker,
  children,
}: {
  icon: typeof Monitor;
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel rounded p-6 sm:p-8">
      <header className="flex items-start gap-3 mb-5">
        <span
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "oklch(0.78 0.18 70 / 12%)",
            boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 30%)",
          }}
        >
          <Icon className="h-4 w-4 text-amber-300" />
        </span>
        <div>
          <h2 className="font-serif text-2xl font-bold leading-tight">{title}</h2>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1 max-w-[62ch] leading-relaxed">
            {kicker}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}
