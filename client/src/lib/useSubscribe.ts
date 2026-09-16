/**
 * Shared subscribe wiring for every subscribe surface (first-visit modal,
 * right-rail card, edition/story foot callouts, About-page banner).
 *
 * One hook so the four surfaces can't drift: same email validation, same
 * honeypot handling, same error copy, and the same deliberately uniform
 * success message — the server no longer distinguishes "already subscribed"
 * in its response (that would let anyone probe whether an address is on the
 * list), so the UI says "check your inbox" for every outcome and
 * already-confirmed addresses get told by email instead.
 *
 * A successful subscribe also sets a local flag (`hasSubscribed`) that the
 * passive surfaces read to stop pitching someone who already signed up.
 */
import { useState } from "react";
import { toast } from "sonner";
import { getArrival } from "@/lib/attribution";
import { trpc } from "@/lib/trpc";
import { NEWSLETTER_NOTICE_VERSION } from "@shared/legal";
import { trackEvent } from "@/lib/analytics";

const SUBSCRIBED_KEY = "thedesk:subscribed";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True once any subscribe surface on this device completed successfully. */
export function hasSubscribed(): boolean {
  try {
    return window.localStorage.getItem(SUBSCRIBED_KEY) === "1";
  } catch {
    return false;
  }
}

function markSubscribed(): void {
  try {
    window.localStorage.setItem(SUBSCRIBED_KEY, "1");
  } catch {
    // Private browsing / storage denied — the flag is a nicety, not state.
  }
}

export function useSubscribe({
  source,
  onSubscribed,
}: {
  /** Attribution string persisted with the subscriber row (e.g. "right-rail"). */
  source: string;
  /**
   * Optional success handler for surfaces with their own confirmation UI
   * (the modal's "check your inbox" view, the callouts' green panel).
   * When omitted, a default success toast is shown instead.
   */
  onSubscribed?: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [lastSent, setLastSent] = useState(0);
  const [hp, setHp] = useState("");
  /** The address that was actually submitted — survives the input clearing
   *  so confirmation copy ("a link is on its way to …") can show it. */
  const [submittedEmail, setSubmittedEmail] = useState("");

  const mutation = trpc.subscribers.subscribe.useMutation({
    onSuccess: (_res, vars) => {
      // An accepted request is not inbox delivery or a confirmed subscription.
      if (!vars._hp) trackEvent("newsletter_request", "subscribe");
      setError("");
      setLastSent(Date.now());
      setEmail("");
      markSubscribed();
      if (onSubscribed) onSubscribed(vars.email);
      else
        toast.success("Check your inbox", {
          description: "Confirm the email to lock in your subscription.",
        });
    },
    onError: () => {
      setError("Could not subscribe right now. Please try again in a minute.");
      toast.error("Could not subscribe right now. Please try again in a minute.");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address, such as you@example.com.");
      return;
    }
    if (Date.now() - lastSent < 60_000 && email.trim() === submittedEmail) {
      setError("Please wait a minute before requesting another email.");
      return;
    }
    setError("");
    setSubmittedEmail(email.trim());
    // Two different facts, both worth keeping. `source` is which form
    // converted them; the arrival is which channel brought them to the site in
    // the first place, read from the session because by now the referrer is
    // our own page. Undefined when storage was blocked — the subscribe must
    // still go through, unattributed.
    const arrival = getArrival();
    mutation.mutate({
      email: email.trim(),
      source,
      noticeVersion: NEWSLETTER_NOTICE_VERSION,
      arrivalSource: arrival?.source,
      arrivalCampaign: arrival?.campaign ?? undefined,
      _hp: hp,
    });
  }

  return {
    email,
    setEmail,
    hp,
    setHp,
    submittedEmail,
    error,
    lastSent,
    submit,
    busy: mutation.isPending,
  };
}
