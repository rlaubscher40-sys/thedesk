/** One decision for optional measurement, including subscription attribution.
 * Security, authentication and requested newsletter delivery are separate.
 */
const KEY = "thedesk:analytics-disabled";
export const PRIVACY_PREFERENCE_EVENT = "thedesk:privacy-preference";
let disabledInMemory = false;

export function browserRequestsPrivacy(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
    (typeof window !== "undefined" &&
      (window as Window & { doNotTrack?: string }).doNotTrack === "1")
  );
}

export function optionalMeasurementAllowed(): boolean {
  if (typeof window === "undefined" || browserRequestsPrivacy() || disabledInMemory) return false;
  try {
    return window.localStorage?.getItem(KEY) !== "1";
  } catch {
    return false;
  }
}

/** Returns whether the choice survived in persistent storage. Never claims a
 * durable preference when private mode or a quota prevented the write. */
export function setOptionalMeasurement(enabled: boolean): boolean {
  disabledInMemory = !enabled;
  let saved = false;
  try {
    window.localStorage.setItem(KEY, enabled ? "0" : "1");
    saved = true;
  } catch {
    /* The current page still honours the choice. */
  }
  if (!optionalMeasurementAllowed()) clearMeasurementSession();
  window.dispatchEvent(new Event(PRIVACY_PREFERENCE_EVENT));
  return saved;
}

export function clearMeasurementSession(): void {
  try {
    window.sessionStorage.removeItem("thedesk:session");
    window.sessionStorage.removeItem("thedesk:arrival");
  } catch {
    /* Blocked storage cannot prevent opting out. */
  }
}
