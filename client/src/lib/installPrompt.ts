// Captures the beforeinstallprompt event (Android / desktop Chrome/Edge)
// so the InstallApp page can call .prompt() on demand.
// Must be imported early (main.tsx) so the event isn't missed.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let _deferred: BeforeInstallPromptEvent | null = null;

export function initInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferred = e as BeforeInstallPromptEvent;
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return _deferred;
}

export function clearDeferredPrompt(): void {
  _deferred = null;
}
