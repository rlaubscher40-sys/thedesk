/**
 * 96×96 placeholder thumbnail. Generates a deterministic category-tinted
 * gradient based on the supplied seed so each card has a distinct mark
 * without a real photo.
 *
 * (In production this would be a real image URL.)
 */
import { categoryColour } from "@/lib/category";
import type { Category } from "@/data/editions/2026-05-15";

function seedHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function Thumbnail({
  seed,
  category,
  size = 96,
  imageUrl,
}: {
  seed: string;
  category: Category;
  size?: number;
  /** Optional real image. When supplied the gradient plate is replaced. */
  imageUrl?: string | null;
}) {
  const cat = categoryColour(category);
  const hue = seedHue(seed);
  if (imageUrl) {
    return (
      <div
        className="rounded overflow-hidden relative shrink-0"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <span
          className="absolute inset-0"
          style={{ boxShadow: `inset 0 0 0 1px ${cat}33` }}
        />
      </div>
    );
  }
  return (
    <div
      className="rounded overflow-hidden relative shrink-0"
      style={{
        width: size,
        height: size,
        background: `
          radial-gradient(circle at 78% 22%, ${cat}55 0%, transparent 55%),
          radial-gradient(circle at 12% 88%, hsl(${(hue + 200) % 360}, 60%, 30%) 0%, transparent 55%),
          linear-gradient(135deg, oklch(0.14 0.018 260), oklch(0.08 0.018 260))
        `,
      }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 noise-overlay"
        style={{ opacity: 0.5 }}
      />
      <span
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 0 1px ${cat}33, inset 0 0 24px oklch(0 0 0 / 35%)`,
        }}
      />
    </div>
  );
}
