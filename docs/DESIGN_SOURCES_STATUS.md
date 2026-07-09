# Design sources — sync status

**Last audited: 2026-07-07.** The files in `docs/` + root `css.txt` + `NN_DASHBOARD.png` are
**client-provided snapshots** (Figma export + behavior notes). They are NOT updated when the app
changes — before basing any decision on them, check this table and, when in doubt, the code.

**Precedence:** code (current truth) → **`desired-look.*` (the current design, see below)** →
older Figma export (`css.txt` / `NN_DASHBOARD.png`) → `docs/*.txt` notes. Where sources disagree,
the newer one wins.

## CURRENT design source — `desired-look.*` (the "metal" redesign, 2026-07-07)

`docs/desired-look.txt` (full Figma CSS export) + `docs/desired-look-dashboard.png` (rendered mockup)
are the **authoritative** design for the overlay chrome. They **SUPERSEDE `NN_DASHBOARD.png` and the
header / AIR / subject-tab / note-shadow / footer sections of `css.txt`** — the old export is
light-mode/pre-metal and only still authoritative for parts `desired-look.*` doesn't cover.

**Implemented 2026-07-07** (all in `src/overlay/`; visually calibrated closely to the mockup, not the
raw Figma pixel values — Figma's box-shadows render muddy in-browser, so several are reproduced with CSS
gradients instead):

- **Metal header bar** — `.nn-metal-bar` (styles.css: accent `#29abe2` + top light-blue hilite +
  inset bottom depth), applied to **row 1 only** (the `BrandHeaderBar` in `DashboardHeader.tsx`); the
  id-scoped rule overrides the shared band so modals/trial bar stay gray. Row 2 (nav) stays a
  **white-framed button strip** (`bg-background` surround). MIN|MAX|DELETE cluster recolored
  `bg-muted → bg-[#b7b5b5]` (Figma `BOX_THIS TAB...MIN MAX DELETE`). DELETE TAB is `#313131` (default
  variant, already correct).
- **Nav-bar fog** = Figma `WHITE HILITE ON NAV BAR`: a blurred translucent band
  (`rgba(217,217,217,0.63)`, `blur`) pinned to the **top of row 2**, `clip-path:inset(0 0 -20px 0)`
  clips the upward blur at the seam so it never shows on row 1's bottom. In `DashboardHeader.tsx`.
- **A–Z boxes** (`AlphabetIndexRollout.tsx` + styles.css `[data-air-cell]`): metallic gradient,
  **dark-top → light-bottom** (gray `#505050→#7c7c7c→#9d9d9d`; tapped/matching-hover → blue
  `#14709a→#29abe2→#5bbfef` via `[data-air-match]:hover` / `[aria-pressed="true"]`). 1px white border
  on **3 sides** (`border-x border-t`; last cell adds `border-b`) so junctions are a single 1px line,
  not 2px; the column's old `border-r border-border` was removed (it clipped the cells' right border).
  `--shadow-air-cell` bevel = dark shadow top + light edge bottom. `--shadow-air` = the larger overall
  column drop shadow (Figma "AI SHADOW"). The old `--color-air-cell` token was removed.
- **Subject tabs** (styles.css `[data-slot="tabs-trigger"]`): dark metallic gradient, dark-top →
  light-bottom, to match the A–Z rail. Alignment fixed in `SubjectTabStrip.tsx` — removed
  `-translate-y-px` and `first:border-l-0` (both were calibrated to the old A–Z `border-b`; the tabs
  now sit on the new `border-t` lines and the first tab keeps its top border = the line under the "+").
- **Blue current-page note drop shadow** (`Note.tsx`): on `matchesCurrentPage`, both collapsed and
  expanded (Figma `NOTE_01_EXPANDED` / `NOTE_02_COLLAPSED`).
- **Metal footer bar** — new `DashboardFooter.tsx` (wired in `App.tsx` as the 3rd child of the
  content column): `.nn-metal-bar` + `© 2026 NOTES FOR NET` (Inter bold, wide tracking). Always
  visible (incl. empty states).
- **"+" add-tab button** (`AddSubjectTabButton.tsx`): border bumped to 2px (Figma `Rectangle 28`).
- Note action buttons' ANCHOR/COPY **blue active states already existed** (`NoteUrlEditor.tsx`) — no
  change needed, they match Figma `BOX_ANCHOR`.

**Polish pass (2026-07-08, signed off):**

- **B/I/U buttons** (`NoteUrlEditor.tsx`): Inter (`font-ui`, not the host Fjalla default) + **pure black**
  glyphs (was `text-primary` #313131); weights B=700, I=italic 500, U=700+underline (Figma `B`/`I`/`U`).
  Background stays `bg-note` #d9d9d9; active toggle stays `bg-accent`.
- **URL label + date box** (`NoteUrlEditor.tsx`): dropped `leading-none` so they vertically center like
  the URL input beside them (the tiny 1-line box was riding high); date box lost a stray `px-2`.
- **Panel frame** (`App.tsx`, the `#nn-scroll-bookmarks-overlay-host` `<main>`): `border-[3px]
  border-[#282828]` around the whole overlay (Figma `MN_STROKE_DB`, 3px solid #282828).
- **A–Z first cell** (`AlphabetIndexRollout.tsx`): first cell drops `border-t` so the "A" sits flush at
  the top (per design); dividers between letters (each cell's `border-t`) stay.
- **Subject-tab label centering** (`SubjectTabStrip.tsx`): `pt-[0.3125rem]` centers the 1.875rem label
  line across the w-10 (2.5rem) strip thickness — base `items-start` had pinned it to the visual-right edge.
- **Subject-tab click flicker fix**: `tabs.tsx` `transition-all → transition-colors` (keep the rotated
  transform out of the animation) **and** styles.css tab gradient `background → background-image` (so the
  base `bg-subject-tab` color stays opaque — the shorthand was resetting it to transparent, flashing a
  see-through gap for a frame when the tab activated).

**Tests:** the 6 e2e visual baselines were **regenerated + reviewed on sign-off (2026-07-08)** and are
current (39 tests / 11 specs green). Refresh again with `npm run test:e2e:update` (calibration machine
only) after any further intended design change.

## Known divergences from the current app

| Source | Says | App today | Where |
|---|---|---|---|
| `css.txt` ~3179 | "+" button glyph = Fjalla 55.77 font glyph | Inline SVG vector plus (symmetric 24×24 viewBox, height `0.58×--air-cell`; Windows gets a −1 viewBox y-nudge) | `src/overlay/AddSubjectTabButton.tsx`, `src/overlay/styles.css` |
| `docs/1_NN_DASHBOARD` | First-run message is a single sentence | Figma two-line + accent "OR" layout shipped (Figma wins) | `src/overlay/DashboardContent.tsx` |
| `docs/3_NN_NOTES` | Notes have a "price" field | No code exists for it (never built) | — |
| `docs/2` (implied smooth tab cueing) | — | Tab-strip scroll-snap deliberately DROPPED (client-approved: Chrome scroll-snap freezes the mouse wheel); plain native scrolling | `src/overlay/SubjectTabStrip.tsx` |

## Resolved (matched the sources again)

| Source | Item | Resolved |
|---|---|---|
| `css.txt` 3135 (`TOP_BAR_NOTES FOR NET` = Inter) | Header badge wrongly rendered Fjalla (host-wide font rule beat `.font-ui`); modals were Inter | 2026-07-02 — ID-scoped `.font-ui` re-assert in `styles.css`; regression-tested in `tests/e2e` |
| `docs/3` ~L214 ("trash can icon" deletes a note) | Delete icon was a `Columns4` placeholder | 2026-07-02 — client's Figma `TRASH ICON-01` inlined as `src/overlay/TrashIcon.tsx` |

## Maintenance rule

When a UI change diverges from (or re-matches) these sources: update this table, and if the spot is
inside `css.txt`/`docs/*.txt`, drop an inline `[OUTDATED <date>]` marker next to it. `NN_DASHBOARD.png`
cannot be annotated — its divergences live only in this file.
