import React from "react";

import {
  AIR_LETTERS,
  lettersWithMatchingTabs,
  type AirLetter,
} from "@/lib/airSubjectTabs";
import { cn } from "@/lib/utils";
import type { SubjectTabStripItem } from "@/overlay/SubjectTabStrip";

type AlphabetIndexRolloutProps = {
  tabs: SubjectTabStripItem[];
  activeLetter: AirLetter | null;
  onLetterSelect: (letter: AirLetter) => void;
  className?: string;
};

/**
 * AIR (Alphabetical Index Rollout): A–Z column to the left of the subject tab strip (AIR-2).
 * Letters share the column height equally (no vertical scroll). Letters with no matching tabs are inert on click.
 */
export function AlphabetIndexRollout({
  tabs,
  activeLetter,
  onLetterSelect,
  className,
}: AlphabetIndexRolloutProps): React.ReactElement {
  const activeLetters = lettersWithMatchingTabs(tabs);

  return (
    <div
      className={cn(
        "flex h-full w-10 shrink-0 flex-col overflow-y-auto overflow-x-hidden hidden-scrollbar border-r border-border bg-air-box",
        className,
      )}
      aria-label="Alphabetical index"
    >
      {AIR_LETTERS.map((letter) => {
        const hasMatch = activeLetters.has(letter);
        const isActive = activeLetter === letter;
        return (
          <button
            key={letter}
            type="button"
            aria-label={`Jump to subject tabs starting with ${letter}`}
            onClick={() => {
              if (!hasMatch) {
                return;
              }
              onLetterSelect(letter);
            }}
            className={cn(
              "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden border-b border-l border-border text-center font-normal outline-none",
              "text-air-letter leading-none",
              "bg-air-box text-accent-foreground",
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
