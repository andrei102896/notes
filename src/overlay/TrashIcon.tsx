import React from "react";

/** Trash icon (Figma "TRASH ICON-01") for the note delete control — inlined since the repo has no SVG-import pipeline; stroke/fill inherit so currentColor renders it in the caller's text color. */
export function TrashIcon(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 22 21"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <rect x="1" y="1" width="19.1077" height="18.2983" />
      <path d="M4.79688 1.93323V18.8485" />
      <path d="M8.63477 1.93323V18.8485" />
      <path d="M12.4727 1.93323V18.8485" />
      <path d="M16.3101 1.93323V18.8485" />
    </svg>
  );
}
