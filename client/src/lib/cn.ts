import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** clsx + tailwind-merge in one call. Used everywhere; keep it tiny. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
