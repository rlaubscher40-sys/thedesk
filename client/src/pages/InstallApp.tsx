import { useState } from "react";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { clearDeferredPrompt, getDeferredPrompt } from "@/lib/installPrompt";
import { CheckCircle, Download, Monitor, Share2, Smartphone, Tablet } from "lucide-react";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !!(window.navigator as Navigator & { standalone?: boolean }).standalone ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

type Step = { icon: string; text: React.ReactNode };

const IOS_STEPS: Step[] = [
  { icon: "1", text: <>Make sure you're in <strong>Safari</strong> (not Chrome or Firefox)</> },
  { icon: "2", text: <>Tap <strong>Add to Home Screen</strong> using the button below, or tap the Share icon (⬆) in Safari's toolbar</> },
  { icon: "3", text: <>Tap <strong>Add</strong> in the top-right corner</> },
];

const ANDROID_STEPS: Step[] = [
  { icon: "1", text: <>Tap <strong>Install App</strong> using the button below</> },
  { icon: "2", text: <>Or open in <strong>Chrome</strong>, tap the three-dot menu, then <strong>Add to Home Screen</strong></> },
];

const DESKTOP_STEPS: Step[] = [
  { icon: "1", text: <>Click <strong>Install App</strong> using the button below</> },
  { icon: "2", text: <>Or look for the <strong>install icon</strong> in the address bar on the right (Chrome / Edge)</> },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3 mt-4">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold text-amber-300"
            style={{ background: "oklch(0.75 0.18 70 / 15%)", border: "1px solid oklch(0.75 0.18 70 / 30%)" }}
          >
            {step.icon}
          </span>
          <span className="text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
            {step.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

function InstallButton({ platform }: { platform: Platform }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-amber-300 font-mono">
        <CheckCircle className="h-4 w-4" /> Done — check your home screen
      </div>
    );
  }

  // iOS Safari: open the native share sheet (closest we can get to a one-tap install)
  if (platform === "ios" && canShare()) {
    return (
      <button
        onClick={() =>
          navigator.share({ title: "The Desk", url: window.location.origin }).catch(() => {})
        }
        className="inline-flex items-center gap-2 px-5 py-3 rounded-sm font-mono text-[11px] uppercase tracking-[0.18em] font-semibold transition-all active:scale-[0.97]"
        style={{
          background: "var(--grad-cta-amber, oklch(0.75 0.18 70))",
          color: "oklch(0.13 0.018 260)",
          boxShadow: "0 4px 14px oklch(0.75 0.18 70 / 30%)",
        }}
      >
        <Share2 className="h-4 w-4" />
        Add to Home Screen
      </button>
    );
  }

  // Android / Desktop: use the deferred beforeinstallprompt if available
  const deferred = getDeferredPrompt();
  if (deferred) {
    return (
      <button
        onClick={async () => {
          await deferred.prompt();
          const { outcome } = await deferred.userChoice;
          if (outcome === "accepted") {
            clearDeferredPrompt();
            setDone(true);
          }
        }}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-sm font-mono text-[11px] uppercase tracking-[0.18em] font-semibold transition-all active:scale-[0.97]"
        style={{
          background: "var(--grad-cta-amber, oklch(0.75 0.18 70))",
          color: "oklch(0.13 0.018 260)",
          boxShadow: "0 4px 14px oklch(0.75 0.18 70 / 30%)",
        }}
      >
        <Download className="h-4 w-4" />
        Install App
      </button>
    );
  }

  return null;
}

type CardProps = {
  title: string;
  icon: React.ReactNode;
  steps: Step[];
  active: boolean;
  platform: Platform;
};

function PlatformCard({ title, icon, steps, active, platform }: CardProps) {
  return (
    <div
      className="panel rounded-sm p-6"
      style={active ? { boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 40%)" } : undefined}
    >
      <div className="flex items-center gap-3 mb-1">
        <span className={active ? "text-amber-400" : "text-[var(--color-fg-muted)]"}>
          {icon}
        </span>
        <h2 className="font-serif font-bold text-lg text-[var(--color-fg)]">{title}</h2>
        {active && (
          <span
            className="ml-auto font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full text-amber-300"
            style={{ background: "oklch(0.75 0.18 70 / 12%)", border: "1px solid oklch(0.75 0.18 70 / 28%)" }}
          >
            Your device
          </span>
        )}
      </div>
      <StepList steps={steps} />
      {active && (
        <div className="mt-5">
          <InstallButton platform={platform} />
        </div>
      )}
    </div>
  );
}

export default function InstallApp() {
  useDocumentTitle("Get the App");
  const platform = detectPlatform();
  const installed = isStandalone();

  if (installed) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <CheckCircle className="mx-auto h-10 w-10 text-amber-400" />
        <h1 className="font-serif font-bold text-2xl text-[var(--color-fg)]">Already installed.</h1>
        <p className="text-[var(--color-fg-muted)] text-[15px]">
          The Desk is running as an installed app on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <p className="overline-amber mb-3" style={{ letterSpacing: "0.22em", fontSize: "10px" }}>
          Get the App
        </p>
        <h1
          className="font-serif font-bold tracking-tight text-[var(--color-fg)]"
          style={{ fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 1.05 }}
        >
          Install The Desk on your device.
        </h1>
        <p className="mt-3 text-[var(--color-fg-muted)] text-[15px] leading-relaxed max-w-prose">
          No App Store required. Install directly from your browser and it'll live
          on your home screen like any native app.
        </p>
      </div>

      <div className="space-y-4">
        <PlatformCard
          title="iPhone & iPad"
          icon={<Smartphone className="h-5 w-5" />}
          steps={IOS_STEPS}
          active={platform === "ios"}
          platform="ios"
        />
        <PlatformCard
          title="Android"
          icon={<Tablet className="h-5 w-5" />}
          steps={ANDROID_STEPS}
          active={platform === "android"}
          platform="android"
        />
        <PlatformCard
          title="Desktop"
          icon={<Monitor className="h-5 w-5" />}
          steps={DESKTOP_STEPS}
          active={platform === "desktop"}
          platform="desktop"
        />
      </div>
    </div>
  );
}
