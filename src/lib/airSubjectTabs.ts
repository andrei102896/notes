/** AIR (Alphabetical Index Rollout) helpers — see jira.md AIR-2. */

export const AIR_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

export type AirLetter = (typeof AIR_LETTERS)[number];

/** First ASCII A–Z letter of a subject tab name, or null if it does not start with A–Z. */
export function firstSubjectTabLetter(name: string): AirLetter | null {
  const t = name.trim();
  if (t.length === 0) {
    return null;
  }
  const u = t[0].toUpperCase();
  if (u.length !== 1 || u < "A" || u > "Z") {
    return null;
  }
  return u as AirLetter;
}

export function lettersWithMatchingTabs(
  tabs: readonly { name: string }[],
): Set<AirLetter> {
  const s = new Set<AirLetter>();
  for (const tab of tabs) {
    const L = firstSubjectTabLetter(tab.name);
    if (L) {
      s.add(L);
    }
  }
  return s;
}

export function indexOfFirstTabForLetter(
  sortedTabs: readonly { name: string }[],
  letter: string,
): number {
  const L = letter.toUpperCase();
  if (L.length !== 1 || L < "A" || L > "Z") {
    return -1;
  }
  return sortedTabs.findIndex(
    (tab) => firstSubjectTabLetter(tab.name) === L,
  );
}
