import React, { useState } from "react";

import {
  AIR_LETTERS,
  lettersWithMatchingTabs,
  type AirLetter,
} from "@/lib/airSubjectTabs";
import { cn } from "@/lib/utils";
import type { SubjectTabStripItem } from "@/types/nnData";

type AlphabetIndexRolloutProps = {
  tabs: SubjectTabStripItem[];
  onLetterSelect: (letter: AirLetter) => void;
  className?: string;
};

/** AIR (Alphabetical Index Rollout): A–Z column left of the subject tab strip (AIR-2); letters share column height equally (no scroll), letters with no matching tabs are inert on click. */
export function AlphabetIndexRollout({
  tabs,
  onLetterSelect,
  className,
}: AlphabetIndexRolloutProps): React.ReactElement {
  const activeLetters = lettersWithMatchingTabs(tabs);

  // AIR is a one-way street: the highlight is driven ONLY by tapping an AI letter — selecting a subject tab never changes it (client 2026-07-04).
  const [highlightedLetter, setHighlightedLetter] = useState<AirLetter | null>(
    null,
  );

  return (
    <div
      className={cn(
        "flex h-full w-10 shrink-0 flex-col overflow-hidden bg-air-box shadow-air",
        className,
      )}
      aria-label="Alphabetical index"
    >
      {AIR_LETTERS.map((letter, index) => {
        const hasMatch = activeLetters.has(letter);
        const isActive = highlightedLetter === letter;
        const isFirst = index === 0;
        const isLast = index === AIR_LETTERS.length - 1;
        return (
          <button
            key={letter}
            type="button"
            aria-label={`Jump to subject tabs starting with ${letter}`}
            onClick={() => {
              if (!hasMatch) {
                return;
              }
              setHighlightedLetter(letter);
              onLetterSelect(letter);
            }}
            data-air-cell
            data-air-match={hasMatch || undefined}
            className={cn(
              // border-x + border-t (not full border) so adjacent cells share ONE 1px white line — no 2px doubling at the vertical junction; the first cell drops border-t so A sits flush at the top (per design); the last cell adds border-b for the column's bottom edge.
              "flex h-[var(--air-cell)] w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden border-x border-white text-center font-normal outline-none",
              !isFirst && "border-t",
              isLast && "border-b",
              "text-air-letter leading-none",
              // Background gradient (gray → blue when tapped/matching-hover) is in styles.css, keyed on data-air-cell / data-air-match / aria-pressed.
              "text-accent-foreground shadow-air-cell",
            )}
            aria-pressed={isActive}
          >
            <span className="origin-center rotate-90">{letter}</span>
          </button>
        );
      })}
    </div>
  );
}
