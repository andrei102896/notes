# Design sources — sync status

**Last audited: 2026-08-01.** The files in `docs/` + root `css.txt` + `NN_DASHBOARD.png` are
**client-provided snapshots** (Figma export + behavior notes). They are NOT updated when the app
changes — before basing any decision on them, check this table and, when in doubt, the code.

**Precedence:** code (current truth) → **per-section Figma CSS pasted in chat during the
2026-07-28 modal/dashboard redesign (see `REDESIGN_2026-07-28_STATUS.md`)** → `desired-look.*` →
older Figma export (`css.txt` / `NN_DASHBOARD.png`) → `docs/*.txt` notes. Where sources disagree,
the newer one wins.

## [OUTDATED for the redesigned areas] — 2026-07-28, extended 2026-08-01

An in-progress section-by-section reskin supersedes the sources below **for modals, the brand band,
the nav-bar bottom edge, subject-tab sizing, the `+` button, the panel border, the scrollbar, the
first-run screen, the note body and the purchase modal**.
Those newer specs arrived as chat-pasted Figma CSS + screenshots and are summarised in
**`docs/REDESIGN_2026-07-28_STATUS.md`** — read it before trusting `desired-look.*` or `css.txt` on
any of those areas. Notably now stale in the older snapshots:

- `desired-look.*` header/brand band (gray band + "NOTES FOR NET" wordmark + "CHROME EXTENSION"
  pill) → replaced by a blue metal band carrying only the NN logo plate. The components that built it
  (`BrandHeaderBar`, `BrandLockup`, `BrandLogo`) were **deleted 2026-07-28**, so the 2026-07-07 notes
  below naming them describe code that no longer exists — read them as history.
- Subject-tab labels are no longer forced to upper case (client request 2026-07-28); any older note
  saying names display in caps is stale.
- The **footer** is no longer the copyright line — it is a second copy of the header's metal band with
  the NN plate (client 2026-07-28). Any snapshot showing `© 2026 Notes for Net` at the panel bottom is
  stale.
- The panel's **top** border is gone (the header band is the top edge), so the strip's `+` and the A–Z
  column's first cell are flush with the panel top. Snapshots showing a blue line above them are stale.
- Plate/rim/scrollbar values changed repeatedly during the sprint — do not trust ANY older snapshot for
  them. `docs/REDESIGN_2026-07-28_STATUS.md` → "Current values" is the single answer. Final plate ratio is
  **3.1:1** (2026-07-29), anchored to the ADD NOTE button, not the 3.5 earlier comps implied, and the NN ink
  covers **52.5% of the plate width** — the artwork's own fraction. The purchase plate matches the
  dashboard's in size AND rendered proportions despite being a different export.
- The `+` button's white border is **3px** (was 4) and its glyph is **71% of the blue box's width** (was
  61%), both measured off a client Figma crop 2026-07-29.
- The panel now casts a **lateral shadow** down its left edge onto the host page (client "SHADOW UNDER AI
  BOXES"); it lives on the host-page shell, not in the iframe. No older snapshot shows it.
- The paid-state header logo opens `https://www.notesfornet.com/updates` (client 2026-07-29).
- **Client feedback round, 2026-07-31 → 2026-08-01** — every older snapshot is stale on these:
  - **Note body**: still #D9D9D9 with #464646 text — the NN watermark is BLURRED ("note logo BG"). It was
    accent blue for that round; **the client reversed that on 2026-08-02** ("no blue letters… the Figma is a
    blurred off white"), so it is now their OWN artwork: `NoteWatermark.tsx` = their `N.svg` + `N (1).svg`
    paths (160×100 and 170×100, a 10-unit channel between them) in #E4E8E9 at their exported 0.5 fill-opacity
    — 6 levels of contrast, a bare shade, per their hi-res export.
  - **First run**: was a box on the grey dashboard; now the full-panel NN backdrop with the box on it, and
    the nav row, A–Z rail and strip are covered. Clicking its `+` swaps the box, backdrop untouched.
  - **Purchase modal**: gained the client's STATEMENT box (665×219, `rgba(41,171,226,0.1)`, 0.3px accent
    hairline, Familjen Grotesk 17/21) and its background squares now spread across the panel instead of
    smearing down the middle.
  - **Metal bar**: the flanking HEADER BOXes now read as their own layer (they paint over the hilite, with
    a deep-blue hairline), and the hilite is 36% of the bar height, not 40%.
  - **Nav-bar bottom edge**: accent line + a 3px WHITE BAR + the blurred dark band beneath, with the notes
    list's top padding deepened so the two shadows merge before the first note.
  - **Subject tabs**: no longer quantised to A–Z cells — the label plus one blank character, nothing more.
  - **Buttons/labels**: modal CANCEL/OK are centred on their GLYPHS (`text-box` trim), not on the line box.
    The note title got the same trim on 08-01 and **lost it again on 08-02** — an input clips its inner
    editor, so the trim cropped the caps and every descender (client-reported).
  - **Fonts**: Familjen Grotesk 400 is bundled (SIL OFL 1.1) for the statement box only.
- `docs/2_NN_SUBJECT TAB ATTRIBUTES AND BEHAVIOR.txt`: "character limit of nine [8]" → **25 chars
  incl. spaces**; "boxes will be one size equivalent to [3] alphabetical index boxes" → **the label plus
  one blank character each end, and nothing else** — the 3-cell floor went 2026-07-28 and the round-up to
  whole A–Z cells went 2026-07-31 (client: "do not try to line it up with alpha index boxes"), so tab
  edges no longer meet the A–Z rows; subject-tab point size 24 still correct.
- `docs/4_NN_AI  ATTRIBUTES AND BEHAVIOR.txt`: "AI letters point size of 26" → **24**.
- `docs/1_NN_DASHBOARD ATTRIBUTES.txt` + `3_NN_NOTES  ATTRIBUTES.txt`: modal look/feel only —
  behaviour notes still hold.

## CURRENT design source — `desired-look.*` (the "metal" redesign, 2026-07-07)

`docs/desired-look.txt` (full Figma CSS export) + `docs/desired-look-dashboard.png` (rendered mockup)
are the **authoritative** design for the overlay chrome. They **SUPERSEDE `NN_DASHBOARD.png` and the
header / AIR / subject-tab / note-shadow / footer sections of `css.txt`** — the old export is
light-mode/pre-metal and only still authoritative for parts `desired-look.*` doesn't cover.

**Implemented 2026-07-07** (all in `src/overlay/`; visually calibrated closely to the mockup, not the
raw Figma pixel values — Figma's box-shadows render muddy in-browser, so several are reproduced with CSS
gradients instead):

- **Metal header bar** — [`.nn-metal-bar` is DEAD as of 2026-07-28: the bar moved to Tailwind utilities in
  `BrandMetalHeaderBar`; the rule has no consumer left.] `.nn-metal-bar` (styles.css: accent `#29abe2` + top light-blue hilite +
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
  content column): [BOTH STALE 2026-07-28 — the footer is now a copy of the header band, no copyright
  line, and `.nn-metal-bar` is dead.] `.nn-metal-bar` + `© 2026 NOTES FOR NET` (Inter bold, wide tracking). Always
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

**Tests:** the suite is **81 tests / 27 specs**, last full green run 80/26 on **2026-08-02**, with
`add-subject-tab-modal.png` (modal-button centering), `note-card.png` and `full-panel.png` (the client's
own note watermark artwork) regenerated on that run. Refresh
with `npm run test:e2e:update` (calibration machine only) after any further intended design change, and
review each new PNG before accepting it — that command *is* the design sign-off.

## Known divergences from the current app

| Source | Says | App today | Where |
|---|---|---|---|
| `css.txt` ~3179 | "+" button glyph = Fjalla 55.77 font glyph | Inline SVG vector plus, symmetric `0 0 24 24` viewBox on every platform, sized `71%` of whichever axis of its box is tighter | `src/overlay/AddSubjectTabButton.tsx`, `src/overlay/styles.css` |
| every snapshot | note body's NN watermark is hard-edged and white | The client's own `N.svg` / `N (1).svg` artwork at their #E4E8E9 / 0.5 fill-opacity, 10-unit channel, blurred (2026-08-02) — blur is the only divergence left from their files; background and text colour unchanged | `src/overlay/NoteWatermark.tsx` |
| every snapshot | first run is a box on the dashboard | Full-panel NN backdrop carrying the box; nav row, A–Z rail and strip covered (client 2026-07-31) | `src/overlay/FirstRunPanel.tsx` |
| `desired-look.*` | subject tabs align to the A–Z grid | Length = label + one blank character; edges deliberately do NOT meet the A–Z lines (client 2026-07-31) | `src/overlay/SubjectTabStrip.tsx` |
| Figma "Rectangle 28" 41×39 | first-run "+" is wider than tall | Square (`size-[2.5625rem]`) — 41×39 around a square glyph left 5.5px of blue at the sides vs 4.5px above | `src/overlay/DashboardContent.tsx` |
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
