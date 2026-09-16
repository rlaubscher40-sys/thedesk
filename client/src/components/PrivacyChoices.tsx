import { useEffect, useState } from "react";
import { EDITORIAL_CONTACT } from "@shared/legal";
import {
  browserRequestsPrivacy,
  optionalMeasurementAllowed,
  setOptionalMeasurement,
  PRIVACY_PREFERENCE_EVENT,
} from "@/lib/privacyPreferences";

export function PrivacyChoices() {
  const [enabled, setEnabled] = useState(optionalMeasurementAllowed);
  const [saved, setSaved] = useState<boolean | null>(null);
  const browserPrivacy = browserRequestsPrivacy();
  useEffect(() => {
    const refresh = () => setEnabled(optionalMeasurementAllowed());
    window.addEventListener("storage", refresh);
    window.addEventListener(PRIVACY_PREFERENCE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(PRIVACY_PREFERENCE_EVENT, refresh);
    };
  }, []);
  return (
    <section
      id="privacy-choices"
      className="space-y-4 scroll-mt-8"
      aria-labelledby="privacy-choices-title"
    >
      <h2 id="privacy-choices-title" className="font-serif text-2xl">
        Privacy choices
      </h2>
      <p className="text-sm text-[var(--color-fg-muted)]">
        Optional measurements help us understand page visits, reading actions, signup sources and
        site performance. Turning them off does not affect reading, saved preferences or
        newsletters. This choice applies to this browser and can be changed here any time.
      </p>
      <label className="flex min-h-11 items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={browserPrivacy}
          onChange={(event) => setSaved(setOptionalMeasurement(event.target.checked))}
          className="h-5 w-5 accent-[var(--color-accent-text)]"
        />
        <span>Allow optional site measurements</span>
      </label>
      <p role="status" className="text-sm text-[var(--color-fg-muted)]">
        {browserPrivacy
          ? "Optional measurements are off because your browser sends Do Not Track or Global Privacy Control."
          : saved === false
            ? "Measurements are off. Browser storage is unavailable, so this choice could not be saved."
            : saved === true
              ? `Saved. Optional measurements are ${enabled ? "on" : "off"}.`
              : ""}
      </p>
      <p className="text-sm">
        To request access, correction or deletion of your information, email{" "}
        <a className="underline" href={`mailto:${EDITORIAL_CONTACT}?subject=Privacy%20request`}>
          {EDITORIAL_CONTACT}
        </a>
        . Tell us which account or subscription is involved. Do not send passwords or identity
        documents. We may need to verify your request and explain any records we need to retain.
      </p>
    </section>
  );
}
