/**
 * Landing page for the double-opt-in confirmation link. The Subscribe
 * mutation issues a confirmToken; the (forthcoming) email will point
 * here with ?token=..., this page calls the confirm mutation and
 * tells the reader what happened.
 *
 * Until email delivery is wired up, the same page handles in-product
 * manual confirms (the admin can paste the confirm URL for a subscriber
 * directly).
 */
import { useState } from "react";
import { useSearch } from "wouter";
import { Check, Loader2, X } from "lucide-react";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { trpc } from "@/lib/trpc";

type State =
  | { kind: "missing" }
  | { kind: "ready" }
  | { kind: "pending" }
  | { kind: "ok"; email: string }
  | { kind: "error"; message: string };

export default function ConfirmSubscription() {
  useDocumentTitle("Confirm subscription");
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  // Start in "ready" (show a button) rather than auto-confirming on load.
  // Email security scanners pre-fetch links to check for phishing — if we
  // fired the mutation in useEffect, the scanner would consume the token
  // before the subscriber ever clicks it, leaving them with "invalid link".
  const [state, setState] = useState<State>(
    token ? { kind: "ready" } : { kind: "missing" }
  );

  const confirm = trpc.subscribers.confirm.useMutation();

  function handleConfirm() {
    if (!token || state.kind === "pending") return;
    setState({ kind: "pending" });
    confirm
      .mutateAsync({ token })
      .then((res) => {
        setState({ kind: "ok", email: res.email });
      })
      .catch((err: Error) => {
        setState({
          kind: "error",
          message:
            err.message ?? "That confirmation link is invalid or expired.",
        });
      });
  }


  return (
    <div className="max-w-md mx-auto py-16">
      <div className="panel rounded-sm p-8 sm:p-10 space-y-5">
        <p
          className="overline-amber"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          The Desk · Subscription
        </p>

        {state.kind === "missing" && <MissingToken />}
        {state.kind === "ready" && <ReadyState onConfirm={handleConfirm} loading={false} />}
        {state.kind === "pending" && <PendingState />}
        {state.kind === "ok" && <ConfirmedState email={state.email} />}
        {state.kind === "error" && <ErrorState message={state.message} />}
      </div>
    </div>
  );
}

function MissingToken() {
  return (
    <>
      <h1 className="font-serif text-2xl font-bold leading-tight">
        Missing confirmation token
      </h1>
      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
        This URL needs a <code className="font-mono text-amber-300">?token=…</code>{" "}
        query parameter. Use the link from your confirmation email, or ask the
        editor to resend it.
      </p>
    </>
  );
}

function ReadyState({ onConfirm, loading }: { onConfirm: () => void; loading: boolean }) {
  return (
    <>
      <h1 className="font-serif text-2xl font-bold leading-tight">
        Confirm your subscription.
      </h1>
      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
        Tap the button below to lock in your subscription to The Desk.
      </p>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: "var(--grad-cta-amber)",
          color: "var(--color-on-amber)",
        }}
      >
        Confirm subscription
      </button>
    </>
  );
}

function PendingState() {
  return (
    <>
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
        <h1 className="font-serif text-xl font-bold leading-tight">
          Confirming your subscription
        </h1>
      </div>
      <p className="text-sm text-[var(--color-fg-muted)]">
        One moment.
      </p>
    </>
  );
}

function ConfirmedState({ email }: { email: string }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "oklch(0.72 0.17 155 / 14%)",
            boxShadow: "inset 0 0 0 1px oklch(0.72 0.17 155 / 32%)",
          }}
        >
          <Check className="h-4 w-4" style={{ color: "oklch(0.72 0.17 155)" }} />
        </span>
        <h1 className="font-serif text-2xl font-bold leading-tight">
          You're on the list.
        </h1>
      </div>
      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
        Confirmed{" "}
        <span className="font-mono text-[var(--color-fg)]">{email}</span>. The
        daily brief lands at 7am AEST every weekday, and the weekly edition
        arrives Sunday 7am.
      </p>
      <a
        href="/"
        className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] mt-2"
        style={{
          background:
            "var(--grad-cta-amber)",
          color: "var(--color-on-amber)",
        }}
      >
        Read today's brief
      </a>
    </>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "oklch(0.68 0.20 15 / 14%)",
            boxShadow: "inset 0 0 0 1px oklch(0.68 0.20 15 / 32%)",
          }}
        >
          <X className="h-4 w-4" style={{ color: "oklch(0.68 0.20 15)" }} />
        </span>
        <h1 className="font-serif text-2xl font-bold leading-tight">
          Couldn't confirm
        </h1>
      </div>
      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
        {message}
      </p>
      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
        If the link expired, subscribe again from any edition page and a fresh
        confirmation will be issued.
      </p>
    </>
  );
}
