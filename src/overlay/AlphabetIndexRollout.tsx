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
        "flex h-full w-10 shrink-0 flex-col overflow-hidden border-r border-border bg-air-box shadow-air",
        className,
      )}
      aria-label="Alphabetical index"
    >
      {AIR_LETTERS.map((letter) => {
        const hasMatch = activeLetters.has(letter);
        const isActive = highlightedLetter === letter;
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
            className={cn(
              "flex h-[var(--air-cell)] w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden border-b border-l border-border text-center font-normal outline-none",
              "text-air-letter leading-none",
              "bg-air-box text-accent-foreground",
              // Blue only for the tapped AI letter (one-way); matching letters get a hover cue.
              hasMatch && "hover:bg-accent",
              isActive && "bg-accent",
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
