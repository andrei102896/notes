/** RFC-4122 v4 id. Prefers crypto.randomUUID but falls back to getRandomValues, because randomUUID is
 * secure-context-only (undefined on http:// pages) while getRandomValues is not — so tab/note ids still
 * mint on plain-http sites where the overlay also runs. */
export function generateId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
