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
import { trpc } from "@/lib/trpc";

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
  const [hp, setHp] = useState("");
  /** The address that was actually submitted — survives the input clearing
   *  so confirmation copy ("a link is on its way to …") can show it. */
  const [submittedEmail, setSubmittedEmail] = useState("");

  const mutation = trpc.subscribers.subscribe.useMutation({
    onSuccess: (_res, vars) => {
      setEmail("");
      markSubscribed();
      if (onSubscribed) onSubscribed(vars.email);
      else
        toast.success("Check your inbox", {
          description: "Confirm the email to lock in your subscription.",
        });
    },
    onError: () => {
      toast.error("Couldn't subscribe right now. Try again in a minute.");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      toast.error("That email doesn't look right");
      return;
    }
    setSubmittedEmail(email);
    mutation.mutate({ email, source, _hp: hp });
  }

  return {
    email,
    setEmail,
    hp,
    setHp,
    submittedEmail,
    submit,
    busy: mutation.isPending,
  };
}
