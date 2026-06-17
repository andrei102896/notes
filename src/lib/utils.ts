import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Register custom @theme text sizes applied as `text-*` utilities so twMerge
 * treats them as font-sizes (else it drops them next to a `text-*` color class).
 * Header tokens are intentionally omitted — the header is left exactly as-is.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["air-letter", "subject-label"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
