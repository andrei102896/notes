/** Section gap ≈ a collapsed-note slot (Figma "space equivalent to a collapse note", doc 3_NN_NOTES). */
export const SECTION_GAP_CLASS = "mt-[4rem]";
export const NOTE_GAP_CLASS = "mt-4";

/** Drop hysteresis (px): cursor must clear a row midpoint by this to switch slots — tolerance, no flicker. */
export const DROP_HYSTERESIS_PX = 12;

/** Drag activation distance (px): a move past this is a drag (reorder); a release within it is a click (edit title). */
export const DRAG_ACTIVATION_DISTANCE_PX = 4;

/** Section gap in rem (matches SECTION_GAP_CLASS = 4rem); ×root font px positions the new-section placeholder. */
export const SECTION_GAP_REM = 4;
