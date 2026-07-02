# Design sources — sync status

**Last audited: 2026-07-02.** The files in `docs/` + root `css.txt` + `NN_DASHBOARD.png` are
**client-provided snapshots** (Figma export + behavior notes). They are NOT updated when the app
changes — before basing any decision on them, check this table and, when in doubt, the code.

**Precedence:** code (current truth) → Figma export (`css.txt` / `NN_DASHBOARD.png`) → `docs/*.txt`
notes. Where the export and the .txt notes disagree, Figma wins (see `AGENTS.md` §1).

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
