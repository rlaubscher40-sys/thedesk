/**
 * Honeypot input — visually hidden but DOM-present so form-filler bots
 * spot it and fill it. Real human users never see it; if a submission
 * arrives with the honeypot non-empty, the server rejects it (Zod
 * input validates max-length 0).
 *
 * Field name intentionally banal ("website") so signature-based bot
 * defenders can't spot and skip it. tabIndex=-1 + autoComplete=off
 * keep accessibility tools from focusing or autofilling.
 */
import { type Dispatch, type SetStateAction } from "react";

export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: Dispatch<SetStateAction<string>>;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <label>
        Website
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
