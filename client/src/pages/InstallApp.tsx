import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { CheckCircle, Monitor, Share2, Smartphone, Tablet } from "lucide-react";

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
  return !!(window.navigator as Navigator & { standalone?: boolean }).standalone ||
    window.matchMedia("(display-mode: standalone)").matches;
}

type Step = { icon: string; text: React.ReactNode };

const IOS_STEPS: Step[] = [
  { icon: "1", text: <>Open this page in <strong>Safari</strong> (not Chrome or Firefox)</> },
  { icon: "2", text: <>Tap the <strong>Share</strong> button — the box with an arrow pointing up, in the toolbar at the bottom of the screen</> },
  { icon: "3", text: <>Scroll down and tap <strong>Add to Home Screen</strong></> },
  { icon: "4", text: <>Tap <strong>Add</strong> in the top-right corner</> },
];

const ANDROID_STEPS: Step[] = [
  { icon: "1", text: <>Open this page in <strong>Chrome</strong></> },
  { icon: "2", text: <>Tap the <strong>three-dot menu</strong> in the top-right corner</> },
  { icon: "3", text: <>Tap <strong>Add to Home Screen</strong> or <strong>Install App</strong></> },
  { icon: "4", text: <>Tap <strong>Install</strong> when prompted</> },
];

const DESKTOP_STEPS: Step[] = [
  { icon: "1", text: <>Open this page in <strong>Chrome</strong> or <strong>Edge</strong></> },
  { icon: "2", text: <>Look for the <strong>install icon</strong> (a computer with a down-arrow) in the address bar on the right</> },
  { icon: "3", text: <>Click it and choose <strong>Install</strong></> },
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

type CardProps = {
  title: string;
  icon: React.ReactNode;
  steps: Step[];
  active: boolean;
  label: string;
};

function PlatformCard({ title, icon, steps, active, label }: CardProps) {
  return (
    <div
      className="panel rounded-sm p-6"
      style={
        active
          ? { boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 40%)" }
          : undefined
      }
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
            {label}
          </span>
        )}
      </div>
      <StepList steps={steps} />
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
        <h1 className="font-serif font-bold tracking-tight text-[var(--color-fg)]"
          style={{ fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 1.05 }}>
          Install The Desk on your device.
        </h1>
        <p className="mt-3 text-[var(--color-fg-muted)] text-[15px] leading-relaxed max-w-prose">
          The Desk is a Progressive Web App — no App Store required. Install it
          directly from your browser and it'll live on your home screen like any
          native app.
        </p>
      </div>

      <div className="space-y-4">
        <PlatformCard
          title="iPhone &amp; iPad"
          icon={<Smartphone className="h-5 w-5" />}
          steps={IOS_STEPS}
          active={platform === "ios"}
          label="Your device"
        />
        <PlatformCard
          title="Android"
          icon={<Tablet className="h-5 w-5" />}
          steps={ANDROID_STEPS}
          active={platform === "android"}
          label="Your device"
        />
        <PlatformCard
          title="Desktop"
          icon={<Monitor className="h-5 w-5" />}
          steps={DESKTOP_STEPS}
          active={platform === "desktop"}
          label="Your device"
        />
      </div>

      <div
        className="flex items-start gap-3 rounded-sm px-4 py-3"
        style={{ background: "oklch(0.75 0.18 70 / 8%)", border: "1px solid oklch(0.75 0.18 70 / 20%)" }}
      >
        <Share2 className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
        <p className="text-[13px] leading-snug text-[var(--color-fg-muted)]">
          <span className="text-amber-300 font-medium">Your current device is highlighted above.</span>{" "}
          Follow those steps and The Desk will appear on your home screen within seconds.
        </p>
      </div>
    </div>
  );
}
