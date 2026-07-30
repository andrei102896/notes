# Modal + dashboard redesign — status (2026-07-28)

Section-by-section reskin driven by fresh client Figma exports. Sections 1–28 are **committed**
(2026-07-30, "New redesign"); anything after that is uncommitted working-tree state (user owns all git).

**How this sprint works:** the user sends one section at a time as a *screenshot + Figma CSS*, the
section is implemented, reviewed against a Playwright screenshot artifact, then the next section
arrives. Read every element in a supplied image, not just the part the typed text mentions.

## Design-source precedence for this sprint

New per-section Figma CSS pasted in chat **supersedes** `docs/desired-look.*` for the parts it
covers (modals, brand band, nav-bar bottom edge, subject tabs, `+`, panel border, scrollbar).
`desired-look.*` remains authoritative for everything else. See `DESIGN_SOURCES_STATUS.md`.

The client's Figma is acknowledged (by the user) to be badly structured: **"adapt based on the
delete modal, which was the most complete structurally."** Copy-as-CSS silently drops x/y
positions, blend modes, span-level text colours and layer order — expect to measure the screenshot.

## Shipped sections

| # | Section | Key files |
|---|---------|-----------|
| 1 | Collapsed-note LINK/ANCHOR (gated on a non-empty heading) | `hooks/useNoteLinkAnchor.ts`, `overlay/CollapsedNoteNav.tsx`, `overlay/Note.tsx` |
| 2 | Paid logo → NN updates page in a new tab | `lib/openInNewTab.ts`, `overlay/DashboardHeader.tsx` |
| 3 | Purchase-modal full-panel BG | `overlay/ModalBackdrop.tsx`, `overlay/PaywallDialog.tsx` |
| 4 | Dashboard modal BG behind every small modal | `NnModalShell` in `overlay/NnModalShell.tsx` |
| 5 | Universal delete confirm (467×189) | `overlay/DeleteConfirmModal.tsx`, `overlay/NnModalBox.tsx` |
| 6 | Empty state — first-run **and** deselected | `overlay/DashboardContent.tsx` |
| 7 | Add / rename subject tab (467×211) | `overlay/SubjectTabNameModal.tsx` |
| 8 | Blue notes scrollbar | `.nn-scrollbar` in `overlay/styles.css` |
| 9 | Blue metal brand band (logo plate only) | `BrandMetalHeaderBar` + `NnLogoPlate` in `overlay/BrandLockup.tsx` |
| 10 | Header bottom edge: 2px white + 3px accent + blurred shadow | `overlay/DashboardHeader.tsx` |
| 11 | Dynamic subject tabs, quantised to A–Z cells | `hooks/useSubjectTabCellSpans.ts`, `overlay/SubjectTabStrip.tsx` |
| 12 | `+` button: **3px** white border, fills one A–Z cell, glyph **71%** of the blue box's width | `overlay/AddSubjectTabButton.tsx`, `overlay/SubjectTabStrip.tsx`, `.nn-…[data-add-tab-glyph]` in `overlay/styles.css` |
| 13 | Panel outer border → accent blue | `overlay/App.tsx` |
| 14 | A–Z index letters 26px → 24px | `--text-air-letter` in `overlay/styles.css` |
| 15 | Logo plate: FULL bar height, flush to the panel/modal OUTER top, non-scaling rim | `METAL_BAR_PLATE_CLASS` in `overlay/BrandLockup.tsx`; `overlay/DashboardHeader.tsx`, `overlay/NnModalBox.tsx`, `overlay/ModalBackdrop.tsx` |
| 16 | Rename subject tab (`RENAME SUB TAB MODAL 25-CHARACTER`) — verified, no code change needed | `overlay/SubjectTabNameModal.tsx` via `SubjectTabRenameDialog` |
| 17 | Subject tab names keep upper **and** lower case | `overlay/SubjectTabStrip.tsx`, `hooks/useSubjectTabCellSpans.ts` |
| 18 | Scrollbar: 8px right gutter + pill ends | `.nn-scrollbar` in `overlay/styles.css` |
| 19 | Footer = the header band (same bar, plate and rim); copyright line dropped | `overlay/DashboardFooter.tsx` |
| 20 | Subject tabs: 3-cell floor dropped, length = character count | `hooks/useSubjectTabCellSpans.ts` |
| 21 | Lateral shadow down the panel's left edge (`SHADOW UNDER AI BOXES`) | `content/overlayShell.ts` |
| 22 | Real NN updates URL wired to the paid-state logo (was a placeholder) | `overlay/DashboardHeader.tsx`, `tests/e2e/brand.spec.ts` |
| 23 | Plate narrowed 3.5:1 → **3.1:1** (client: a little wider than ADD NOTE), still flush | `NN_PLATE_ASPECT` in `overlay/BrandLockup.tsx` |
| 24 | Purchase plate == dashboard plate in **size AND proportions** (its own artwork, same box and same rendered NN) | `overlay/ModalBackdrop.tsx`, both compared directly in `tests/e2e/paywall.spec.ts` |
| 25 | Modal backdrop bar carries the DASHBOARD plate, not the purchase one | `plate` slot on `ModalMetalBar`, passed by `overlay/NnModalShell.tsx` |
| 26 | Review-fix pass: version sync, NUL-byte source file, dead classes/params removed, plate numbers derived from one place | `package.json`, `hooks/useSubjectTabCellSpans.ts`, `overlay/BrandLockup.tsx` + specs |
| 27 | NN ink back to the artwork's 52.5% width share — the horizontal counter-scale made it bulky | `overlay/BrandLockup.tsx`, `overlay/ModalBackdrop.tsx` |
| 28 | Headed e2e window parked off-screen so runs stop covering the desktop | `tests/e2e/fixtures.ts` |
| 29 | Nav strip `padding-bottom` 3px → **1px** so the white frame reads even on all four sides (the header's 2px `border-b` stacks under it) | `overlay/DashboardHeader.tsx`, `tests/e2e/nav-strip-frame.spec.ts` |

### Shared modal architecture (the reusable spine)

- **`NnModalShell`** (`NnModalShell.tsx`) — Radix dialog + full-panel `ModalBackdrop` (logo-only bar,
  no tagline) + the modal box centred over it. Every small modal sits in this.
- **`NnModalBox`** (`NnModalBox.tsx`) — Figma `MODAL BG`: 467×189 (`h-[11.8125rem] w-[29.1875rem]`),
  2px accent border, `inset 0 23px 101px` accent glow, blurred accent NN watermark at 70.5%,
  `ModalMetalHeaderBar`. Override the height per modal (add/rename passes `h-[13.1875rem]` = 211px).
  Carries `data-nn-modal-box` for tests.
- **`ModalBackdrop`** (`ModalBackdrop.tsx`) — `#333` + 2px accent frame, 15-square blurred grid,
  ghost NN PNG, two-tone NOTESFORNET, optional tagline (`showTagline`), `header` slot.
- **`BrandMetalHeaderBar`** (`BrandLockup.tsx`) — the one blue metal bar (Figma `TOP METAL BAR DB` +
  flanking `HEADER BOX`es). The dashboard band and `ModalMetalHeaderBar` are both this component; only
  the height differs. **Plate rules (client, 2026-07-28, supersede all Figma CSS numbers):**
  1. the plate spans the FULL bar height AND is flush to the **outer** top edge — the header band
     overlaps the panel's 3px border (`-mt-[3px] h-[calc(var(--air-cell)+3px)]`), while `NnModalBox`
     and `ModalBackdrop` drop their top border entirely (`overflow-hidden` would clip an overlap) and
     `ModalMetalBar` its own border-t. Measure "no gap" against the panel/modal outer box, not the bar
     — that reference error let a 3px gap pass the tests once;
  2. plate width is derived from the bar height, never from a fixed rem and never horizontally from
     `--air-cell`: `aspect-[3.1]` × the bar height. **3.1 is the final value** (2026-07-29) — the client
     anchors the plate to the ADD NOTE button ("a little wider"), and 3.5 read as far too wide at 1.67×
     it. The small modal box's own bar still uses the default `aspect-[3.5]`, since it is a shorter bar
     with no ADD NOTE to anchor to. The raw asset is 4.14:1, hence `preserveAspectRatio="none"`, whose
     non-uniform scale the client accepts — their own comps render this artwork in a 3.1:1 box too;
  3. the rim is a CSS-border overlay in `MetalBarPlate` (`data-nn-plate`), NOT an svg stroke (those
     rescale with the artwork and land sub-pixel): 3px default, **5px on the dashboard/footer/backdrop
     bars**, and as an overlay it never shrinks the NN artwork. N-glyph outlines keep `non-scaling-stroke`.
  Carries `data-nn-metal-bar` for tests.
- **Plate geometry lives in ONE place** (`BrandLockup.tsx`): `NN_PLATE_ASPECT` = 3.1 next to the literal
  `NN_PLATE_CLASS` = `aspect-[3.1]` (both exist because Tailwind's scanner cannot read a template
  literal — they must agree, and `metal-bar.spec.ts` asserts the rendered ratio), `PLATE_GLYPH_SQUEEZE_Y`
  = 0.895 (the vertical squeeze = the client's "+1px padding above and below"). The glyphs are
  deliberately **not** counter-scaled horizontally. A counter-scale was tried 2026-07-29 to make the letter
  shapes geometrically true under `preserveAspectRatio="none"`; it widened the NN from the artwork's 52.5%
  share of the plate to 62.7% and the client called it bulky. What matters is the NN's share of the plate,
  not the letter's abstract shape — the client renders the same artwork non-uniformly too.
  `ModalLogoBox` needs its own squeeze (`× 31/29`) purely because its viewBox is 2 units taller; the same
  number would render its NN 6% shorter than the dashboard's.
- **`MetalBarPlate`** (`BrandLockup.tsx`) — the plate slot: sizing box (`h-full aspect-[3.5]
  max-w-[40%]`, overridden to `NN_PLATE_CLASS` by every bar except the small modal box) + the rim as a
  CSS-border **overlay**, so changing rim thickness never rescales the NN artwork (an svg stroke did, and
  landed sub-pixel). Carries `data-nn-plate`; `rimClassName` overrides the thickness.
- **Two plate artworks, deliberately** (client-confirmed 2026-07-29) — see "Deferred work" for the full
  mapping. `NnLogoPlate` (`BrandLockup.tsx`, 120×29, **black** glyph stroke, inset accent glow, plus the
  `#0081B8` rim added by hand since `LOGO ALL.svg` omitted it) is used everywhere except the purchase
  modal; `ModalLogoBox` (`ModalBackdrop.tsx`, 121×31, `#0081B8` stroke, which reads as no outline) is the
  purchase artwork only. `NnLogoPlate` is exported again so `NnModalShell` can hand it to the backdrop bar.

### Behaviour changes worth remembering

- **Subject-tab length is dictated by the character count alone — no minimum span** (client
  2026-07-28, "DYNAMIC SIZED SUBJECT TABS"; supersedes the earlier 3-cell floor). Label width + one
  blank character each end, rounded **up** to whole A–Z cells so tab edges stay on the grid — that
  rounding is the only length the label doesn't ask for. Measured at the 1400×900 test panel:
  1 char = 1 cell, `GOLF` = 2, 9 chars = 3, 25 chars = 7.
- **Subject-tab name cap 8 → 25 characters** including spaces (`lib/subjectTabName.ts`), per the
  client note.
- **The panel's lateral shadow lives on the host-page shell, not in the iframe** (`content/overlayShell.ts`,
  `-8px 0 44px 8px rgba(26,26,26,0.42)` prepended to the existing lift shadow). An iframe cannot paint
  outside its own box and its shell is exactly panel-width, so an in-app shadow is clipped at the blue
  border. A `box-shadow` never hit-tests, so this steals no clicks from the host page — the alternative
  (a wider iframe with a transparent gutter) would, since `pointer-events` can't be split within one
  iframe. Client's white box in the annotation is a Figma prop for visibility, not an element to build.
- **Subject tab names keep the case they were typed in** — upper *and* lower, end to end (client
  request, 2026-07-28: "really need that rule removed"). The strip no longer calls `toUpperCase()`;
  `useSubjectTabCellSpans` measures the label as displayed, since mixed case is narrower than caps.
  Sorting (`localeCompare` with `sensitivity: "base"`) and A–Z index matching
  (`firstSubjectTabLetter`) were already case-insensitive, so a lower-case name still lands under its
  letter. The modal's own label/button text stays uppercase — that's UI chrome, not a name.
- Name field is fixed-width 245×39 with `px-[1ch]` (the client's "one additional character at front
  and back") and centred text ("populates from center"). Font 20px, not 24.
- First-run empty state was **removed and then restored** — the client confirmed removal, then sent a
  dedicated `CREATE A SUBJECT TAB...` modal with the inline `+`. It is back, with the `+` sized to
  the Figma 41×39 box via `className`.
- Delete confirm's OK is red (`--color-modal-delete`); add/rename's OK is accent blue.
- **The panel lost its top border** (`App.tsx` is `border-x-[3px] border-b-[3px]`, no `border-t`) so the
  header band *is* the top edge and the logo plate sits flush against it. Side effects the client wanted
  anyway: the strip's `+` and the A–Z column's first cell are now flush with the panel's top too — which
  is exactly the "the `+` is stuck to the top" the Figma showed and that I had earlier argued was a
  client mistake. **That earlier recommendation ("keep the frame continuous") is superseded.**
- **Header bottom edge:** the 1px black seam between the metal band and the nav row is gone (it was also
  pushing the logo plate 1px off-centre), and the accent line under the 2px white border is **4px**.
- **The footer is a copy of the header band** — same bar, plate and 5px rim. The `© 2026 Notes for Net`
  line is gone with it, and `--text-brand-sub` went with the line.

### Figma annotation vs UI — the `ASTERIK` layers

The rename-modal dump contains `ASTERIK 1` / `ASTERIK 2`, each a 3px white rule (`Vector 75`, 132px and
134px) plus an `INFO` glyph (20×27, Fjalla **36px**) — the white lines that cross the modal at the name
field's centre in the client's screenshot. These are **artboard annotation, not UI**, and were
deliberately not built:

- each group is 157/158px wide but only 109px separates the field from the modal edge, so they cannot
  sit inside the modal — they run across the whole 564px artboard;
- the paired rules differ by 2px (132 vs 134) — hand-placed, not a symmetric UI pair;
- 36px matches the artboard's other annotation text (`INFO` 527×430, the 403×82 title), all `#FFFFFF`
  and therefore invisible against the white artboard — which is why only the segments crossing the dark
  modal are visible in the export;
- `*` is the client's own footnote marker (`*PLUS PADDING OF 1 ADDITIONAL CHARACTER…`), and the leader
  lines point at the field the red `[NOTE PADDING BEFORE AND AFTER TEXT ENTERED]` note describes — a
  note already implemented as `px-[1ch]`.

If the client does want white rules flanking the field, they are a small addition to
`SubjectTabNameModal`.

## Open questions (asked, not answered)

1. From the dashboard render: notes contain **product images**; note body renders as **one line**,
   not three; collapsed notes show **no LINK** button; a detached larger `+` floats above the panel.
   Which of these are real requirements?
2. Should the **note body's** scrollbar (`RichTextBodyEditor`, `overflow-y-auto`) also get
   `.nn-scrollbar`? Currently Chrome default grey.
3. ~~`NN_UPDATES_URL` is a placeholder~~ — **resolved 2026-07-29**: the client gave
   `https://www.notesfornet.com/updates` (note the `www`, which the placeholder lacked). The paid-state
   logo opens it in a new tab; covered by `brand.spec.ts`, which routes the URL to a stub so the test
   never touches the live site and seeds an expired trial to reach the off-trial branch.
4. ~~The plate rim / "metallic border"~~ — **resolved 2026-07-28**: it is a 5px (header) / 3px (modals)
   CSS-border overlay whose colour is a vertical gradient, light `#9EE2FF` at the top fading to
   `#0B5B80` at the bottom. Two separate corrections got it there: the glow must *cross* the rim (the
   bar's own hilite sits under the plate, so the plate carries the ramp itself) and it must **fade**,
   never step between two flat colours — a `clip-path`ped second border did exactly that, and so did a
   gradient that flattened at `#0081B8` halfway down.
5. ~~The `+` square vs filling its cell~~ — **resolved 2026-07-28**: the client called the square
   version asymmetric, so the `+` now fills one whole A–Z cell. A square cannot have equal margins in a
   29×34.6 cell, and as a square it had 0 margin left/right but 2.73px *transparent* slivers top and
   bottom (the wrapper has no background, so the host page showed through). Filling the cell gives zero
   margin all round and the same footprint as the letter box beside it. The glyph is centred on each
   axis; the blue gap is 3.36px at the sides vs 6.09px top/bottom because the cell is not square —
   equal gaps on both axes would need an uneven white border, which the client already rejected.
   **Updated 2026-07-29** from a Figma crop: white border 4px → **3px** (client: "too much white, strip
   ~1px so more blue shows") and the glyph 61% → **71%** of the blue box's width. 71% is measured off that
   crop — 181px of glyph in a 255px blue box — and the spec asserts the *ratio*, not a px gap, so it holds
   at any panel width. Their crop's blue box is square (255×249) while ours is 23.1×28.6, which is why only
   the width ratio can match and the vertical gap runs larger.

## Deferred work

- **Full suite: 60 passed, 0 failed (2026-07-30).** The five stale `visual.spec.ts` baselines were
  regenerated and signed off after reviewing each new PNG — they had predated the whole sprint (the old
  `header.png` still showed the deleted "NOTES FOR NET / CHROME EXTENSION" wordmark).
- **Known defect, deliberately not fixed: `page.clock.setFixedTime` never reaches the overlay.** The
  content script builds the iframe with `document.write` *after* the clock is installed, so `Date.now()`
  inside the overlay is the real clock and `FIXED_NOW` (`fixtures.ts`) only applies to the host page. A
  note therefore renders today's date, and `full-panel.png` / `note-card.png` bake in the day they were
  generated (`note-card.png` still carries 07/20 and passes only because `maxDiffPixelRatio: 0.001` is
  larger than a two-digit change). Fix by masking the date box in those two snapshots, or by installing
  the freeze in the iframe document after mount.
- **TWO plate designs, deliberately** (client-confirmed 2026-07-29): two separate client exports, not
  accidental duplicates, and only their **size** has to match.
  - `NnLogoPlate` (`overlay/BrandLockup.tsx`, viewBox 120×29, **black** glyph stroke) — everywhere except
    the purchase modal: dashboard band, footer, the small modal box's bar, **and the full-panel backdrop
    bar behind the small modals**.
  - `ModalLogoBox` (`overlay/ModalBackdrop.tsx`, viewBox 121×31, `#0081B8` stroke, which reads as **no
    outline** against the fill) — the purchase modal only.

  `ModalMetalBar` takes a `plate` slot for this: it defaults to the purchase artwork, and `NnModalShell`
  passes the dashboard plate. That bar stands exactly where the brand band was, so before the slot existed
  the top-of-panel logo lost its black outline the moment any modal opened while the modal box below kept
  it — two designs in one frame. Client-confirmed as wrong, fixed 2026-07-29.

  Remaining cost: a new client NN export must be pasted into both files. `NN_PLATE_ASPECT`,
  `PLATE_GLYPH_SQUEEZE_Y` is shared from `BrandLockup.tsx` and `paywall.spec.ts` compares the two plates'
  rendered ink directly, so their size and proportions cannot diverge unnoticed.
- Files over the 300-line ESLint cap that were touched this sprint: `functional.spec.ts` (312),
  `subject-tab-sizing.spec.ts` (306). Split when next adding to them.

## Deleted with the redesign (2026-07-28)

Everything the reskin orphaned, verified unreferenced before removal:

| Removed | Was |
|---|---|
| `NnModalFrame`, `ModalBrandBar`, `ModalCancelButton`, `ModalOkButton`, `MODAL_BUTTON_BASE` | the pre-redesign modal box + its buttons, superseded by `NnModalShell` + `NnModalBox` |
| `BrandHeaderBar` → `BrandLockup` → `BrandLogo` | the gray brand band with "NOTES FOR NET" + the CHROME EXTENSION pill, replaced by `BrandMetalHeaderBar` |
| `--color-chrome-ext`, `--color-logo-box`, `--color-mn-stroke`, `--color-modal-cancel`, `--text-brand-title`, `--text-add-glyph` | tokens used only by the above (`--text-add-glyph` died when the `+` became an SVG) |
| `AddSubjectTabButton`'s optional `onClick` | the handler-less "first-run illustrative cue" mode — both call sites pass a handler, so `onClick` is now required |
| `brand.spec.ts` tests 1 and 3 | they targeted `.bg-logo-box` and the "Notes for Net" / "CHROME EXTENSION" spans; test 2 (fat NN in the trial badge) is live and kept |

The file that held them was **renamed `NnModalFrame.tsx` → `NnModalShell.tsx`** (it keeps only
`NnModalShell` + `ModalWatermark`), and its 4 importers repointed. `NnLogoPlate` and
`ModalMetalHeaderBar` are now module-private (single in-file caller each). `IS_WINDOWS` is no longer
imported by `BrandLockup` — the Windows padding nudge died with the lockup; `AddSubjectTabButton` still
uses it for the `+` viewBox.

## How to run the next redesign (this one cost far too many rounds)

One small element — the NN logo plate — took ~10 review rounds. Almost none of it was the design's
fault; it was the process. Do this instead.

**1. Intake the whole section before writing code.** Ask for all of it at once:
   - the rendered screenshot at 1:1 (not a zoom — a zoom hides the anchor),
   - the CSS of *every* layer in that section, not just the one being discussed,
   - **which element the sizes are relative to.** Most of the plate churn was anchors: 29-in-35 of the
     bar, vs 3.5:1 of itself, vs "as wide as the ADD NOTE container", vs 7.5rem. All were "the size of
     the logo", and each produced a different logo.

**2. Offer rendered variants; never negotiate a number in words.** Every time a value was open (glow
   blur, rim thickness, plate width) the fast path was to render 3 candidates and screenshot them for a
   pick. The slow path — asking "how thick?" or shipping one guess — cost 2–3 rounds each. Producing
   variants is cheap: one temporary spec that mutates the style in `evaluate()` and screenshots each.

**3. When the client's render disagrees with their Figma CSS, the render wins — and say so out loud.**
   Copy-as-CSS drops position, layer order, blend modes, and gradients on strokes. Concrete cases here:
   `filter: drop-shadow(0 0 0 …)` exported as blur 0 while the render shows a glow; the plate asset is
   4.14:1 while every comp compresses it to ~3.5:1; `LOGO ALL.svg` lost the rim that `LOGO + BOX.svg`
   has; the ghost NN SVG lost its blend mode and needed a PNG. If an export looks wrong, ask for a
   flattened PNG early instead of reverse-engineering the filter.

**4. Batch the review.** Implement the whole section, then produce ONE artifact set — the element, a
   zoom, and a neighbourhood shot — and ask for a single pass. Shipping one property per round
   (rim 1px → 2px → 3px → 5px, each its own round) is what stretched this out.

**5. Never answer a visual complaint with "verified, N tests pass".** If the user can see a defect and
   the suite is green, **the test's reference frame is wrong** — fix the test first, then the code. See
   the `+` padding case in the traps list: the button measured 4/4 while the picture showed 5/4.

**6. Keep one current-values table per reworked element** (below). Superseded values are history; the
   table is the answer to "what is it now", so nobody re-derives or re-asks.

### Current values — metal bar + logo plate

| Property | Value | Source |
|---|---|---|
| bar height | `--air-cell` (dashboard band, small-modal bar = `2.1875rem`, purchase bar = `calc(--air-cell + 1px)` to offset its `border-b`) | client: purchase plate must equal the dashboard's |
| plate box | `h-full` + `aspect-[3.1]` (`NN_PLATE_CLASS`) on the dashboard band, footer and modal backdrops; the small modal box's bar keeps the `aspect-[3.5]` default. `max-w-[40%]`, `preserveAspectRatio="none"` | client 2026-07-29: "a little wider than ADD NOTE" — 3.5 measured 1.67× it, 3.1 is 1.48× |
| plate vs ADD NOTE | 1.48× its width at the test panel (asserted `> 1` and `< 1.55`) | the client's only stated anchor for plate width |
| NN ink share | **52.5% of the plate width, 49.4% of its height**, centred — the artwork's own fraction (63 of 120 viewBox units) | client 2026-07-29: a horizontal counter-scale pushed it to 62.7% and read as bulky |
| purchase plate | same box AND same rendered ink as the dashboard's (56.3 × 17.1 at the test panel); `ModalLogoBox` carries `0.895 × 31/29` because its viewBox is taller | client: "exactly as the dashboard one in size and proportions" |
| plate position | flush to the bar AND to the panel/modal **outer** top edge (no `border-t` anywhere above it) | client: "no space between logo and top/bottom" |
| rim | CSS-border overlay in `MetalBarPlate`: 5px on the dashboard band, footer and backdrops / 3px on the small modal box's bar | client: "double in size in the header", then −1px per side |
| rim colour | `border-image: linear-gradient(#9EE2FF → #7DD3F7 15% → #3EA8D8 38% → #0081B8 58% → #14709A 80% → #0B5B80 100%)` | client: the WHITE HILITE must fade through it, and the lower half keeps darkening |
| NN glyph padding | glyphs scaled `scale(1 0.895)` about the plate centre → 3.75px above/below | client: "+1px extra padding top and bottom" |
| flanking boxes | `bg-accent/[0.86]` + `inset 0 -18px 11.2px 3px rgba(0,0,0,0.28)` | Figma `UPDATE____HEADER BOX` |
| footer | the same `BrandMetalHeaderBar` at `--air-cell` with the 5px rim — no copyright text | client: "the footer is the same as the header" |
| glyph outline | `non-scaling-stroke` (both plates); **black** on `NnLogoPlate`, `#0081B8` on the purchase `ModalLogoBox` (reads as no outline) | two separate client exports — only the plate SIZE has to match |
| which artwork where | `NnLogoPlate` everywhere; `ModalLogoBox` in the purchase modal only, via `ModalMetalBar`'s `plate` slot | client 2026-07-29 |

## Traps learned this sprint (all cost real rework)

1. **Never tie a horizontal dimension to `--air-cell`.** `--air-cell` is `calc(100vh / 26)` —
   viewport *height*. Every horizontal dimension scales with panel *width* via the root-font knob
   (`w-10` = 2.5rem). Setting the strip columns to `w-[var(--air-cell)]` made them 34.6px instead of
   29.15px, overflowed the panel (children summed 504.9 in a 494px box; `justify-end` spilled the
   overflow *left*, outside the blue frame onto the host page) and only looked right at the test
   window's aspect ratio. Cells are therefore **not square** except at one viewport aspect.
2. **Rotated subject tabs:** `rotate-90 origin-top-left translate-x-[2.5rem]`. Layout stacks tabs by
   their **unrotated height**; the visible on-strip length is the **width**. The two must be equal or
   the visual extent drifts from the reserved space — hence square boxes sized in whole `--air-cell`
   multiples.
3. **`scrollWidth` lies on tabs.** `TabsTrigger` has an invisible `after:` indicator at `-right-1`,
   which inflates `scrollWidth` by ~3px on every tab. A `scrollWidth > clientWidth` clipping check
   reports false positives; measure the label with canvas against the content box instead.
4. **Element screenshots, not page screenshots,** for artifacts — a full-page shot can catch the
   overlay mid slide-in (or after slide-out) and come out shifted or blank.
5. **Assert what you claim.** A "does hiding it change one pixel" check passed on a ghost logo that
   was humanly invisible. The test now measures the *fraction* of pixels that visibly change (>5%).
6. **The e2e fixture freezes the page clock** at `FIXED_NOW` (2026-07-02). Seed the trial from the
   service worker's real clock, or an "active" trial reads as long expired.
7. **Custom properties defined on `#host` do NOT reach portaled dialogs.** `--air-cell` lived on
   `#nn-scroll-bookmarks-overlay-host`; every modal portals into the iframe `body`, outside it. Setting
   the purchase bar to `h-[var(--air-cell)]` there produced a **57px** bar instead of 34.6, because the
   `height` resolved to `auto` and the layout degenerated silently — no error, no warning. `--air-cell`
   now lives on `:root` (`styles.css`). Anything a modal may need must be declared at the root.
8. **Measure text in the document that owns the element.** `useSubjectTabCellSpans` built its canvas
   with the content-script realm's `document`, which has no Fjalla One — every label was measured with
   fallback metrics (~35% too wide), so a 9-character tab claimed 4–5 A–Z cells instead of 3. Use
   `container.ownerDocument.createElement("canvas")`. `document.fonts.check()` on the iframe's font set
   said "loaded" while the canvas silently used the fallback, so the guard hid the bug rather than
   catching it. (Also: `check()` returns true for any family list containing a generic like `sans-serif`
   — check the first family alone.)
9. **A caller's `items-center` shrinks a bar to its content.** `SubjectTabNameModal` passes
   `items-center` to `NnModalBox`; the metal bar (a flex-column child) collapsed to the plate's 87px
   instead of the box's 336px, which is what the client saw as "no metal left and right of the logo in
   the modals". The bar carries `w-full` so no caller can do that again.
10. **Element screenshots still need the slide-in to finish.** A header-band artifact taken immediately
   captured the band still translated, so the host page showed past the iframe edge as a grey stripe
   over the bar's right 13% — a pure artifact, while `elementFromPoint` reported accent blue there.
   Wait for the panel before screenshotting, and confirm suspicious artifacts against the DOM.
11. The ghost NN PNG (`src/assets/ghost-nn.png`, base64 in `ghostNnPng.ts`) has **max alpha 41/255** —
   it was not flattened with its Figma blend. It reads only because it sits over the square glow. A
   re-export with the blend baked in is a `cp` + regenerate away.

## New tests

| Spec | Covers |
|------|--------|
| `tests/e2e/paywall.spec.ts` | Purchase modal fills the panel, its plate AND its rendered NN ink both equal the dashboard's (all measured in the same DOM, so the rule cannot silently drift), plate flush to the outer top, trial + BUY boxes carry the Figma outline/bg/inset and the 184.34×30 box, trial box centred, ghost NN visibly present (canvas pixel-diff ratio, logged), Escape + BUY dismiss |
| `tests/e2e/modal-backdrop.spec.ts` | Dashboard backdrop behind rename; **its bar carries the same plate artwork as the modal box's bar** (viewBox + stroke compared — the visual baselines cannot see this, the plate is small enough to stay under `maxDiffPixelRatio`); delete confirm holds 467×189; empty-state shell; first-run `+`; name modal fixed field + 25-char cap; rename modal label/prefill/selection + Figma sizes as root-font shares |
| `tests/e2e/subject-tab-sizing.spec.ts` | Length follows the character count with no floor (box ≥ label+padding, < that + one cell; strictly grows with the label), spans whole cells, 1-character padding, 25-char name not clipped, case preserved, `+` fills its cell with zero margin + even border + centred glyph |
| `tests/e2e/metal-bar.spec.ts` | Plate spans the full bar height (zero top/bottom gap, metal left/right, centred), flush to the panel's OUTER top, 3.1:1 box, 1–1.55× the ADD NOTE button, **NN ink covers 52.5% of the plate width / 49.4% of its height and is centred on both axes**, rim equal on 4 sides + gradient that never steps, no black seam between header rows, 4px accent bottom line, footer bar identical to the header |
| `tests/e2e/scrollbar.spec.ts` | Notes list gets `.nn-scrollbar`, an 8px right gutter (pixel-verified, since `background-clip` is what makes the transparent border visible), and pill ends measured by row-width taper with the thumb parked mid-track |
| `tests/e2e/panel-shadow.spec.ts` | The panel's left-edge shadow, scanned in host-page pixels: darkest at the edge, monotonic fade to ~85px, present at the top and bottom of the edge as well as mid-panel |
| `tests/e2e/nav-strip-frame.spec.ts` | The nav strip's white frame: `padding-bottom` 1px + the header's 2px `border-b` = the 3px the other sides get from padding, then the painted proof — a 1px column through ADD NOTE must show the same run of white above and below it (the padding and the border merge into one band, so only pixels can tell 3px from 5px) |

`tests/e2e/functional.spec.ts` and `brand.spec.ts` also changed: two brand tests were **deleted** (they
hunted the removed wordmark) and the surviving font test was repointed twice — first off the deleted
"Notes for Net" spans, then off the footer's copyright line when the footer became a copy of the header.
It now reads a note's URL/date row, the only `font-ui` surface left. `brand.spec.ts` also gained the
NN-updates test (routes the URL to a stub; seeds an expired trial to reach the off-trial branch, since the
default e2e state starts a fresh local trial and shows the red logo instead).

Run a section's own spec after each change (`npx playwright test <spec>`); artifacts land in
`test-results/<test>/*.png` and are the review currency with the user. **`npm run test:e2e` takes ~3
minutes and is worth running before any handoff** — the suite is 60 tests / 20 specs and fully green.

## Where polish left off (last updated 2026-07-29)

Everything the client raised has been implemented and pixel-verified, and a full review pass has been
applied on top (§ sections 22–26). Suite: **60 tests / 20 specs, all green.** Threads that are closed but
likely to come back:

- The plate's *inner* blue glow spreads ~8px horizontally vs ~5px vertically, because
  `preserveAspectRatio="none"` stretches the artwork 1.19× vertically and dilutes the glow there. The rim
  is unaffected. Flagged to the client, not yet answered.
- The scrollbar gutter is `0.5rem` (8px at the reference), so it *scales* with the panel rather than
  being a hard 8px. The client asked for "double the margin"; if they want a rigid 8px at every panel
  size, swap the rem for px in `.nn-scrollbar`.
- `+` glyph gaps are 3.36px at the sides vs 6.09px top/bottom — unavoidable in a non-square cell without
  an uneven white border, which the client rejected. The A–Z cell is taller than wide (`--air-cell` =
  `100vh/26` against a 2.5rem column) whereas the Figma crop's cell is wider than tall; that difference is
  systemic and accepted, so no glyph size can match Figma on both axes at once.
- **The visual baselines have now missed three deliberate changes** (note dates, the modal-backdrop logo
  artwork, and this `+` resize) because `maxDiffPixelRatio: 0.001` is larger than a small element's pixel
  delta. Treat them as a coarse net only; anything that matters gets an explicit geometry/artwork assertion,
  and regenerate them after every intended visual change or the committed reference silently stops
  depicting the app.
- **Dead CSS: `.nn-metal-bar`** (`styles.css`, ~7 lines). The reskin moved the bar to Tailwind utilities in
  `BrandMetalHeaderBar` / `ModalMetalBar`; nothing carries the class any more (only the unrelated
  `data-nn-metal-bar` attribute, which tests use). Left in place because deleting CSS was outside the
  comment-cleanup and review-fix passes — safe to remove.
- **`ModalMetalBar` duplicates most of `BrandMetalHeaderBar`** (same wrapper, same inset shadow, same
  hilite div, near-identical flanking-band class) and exists mainly for the `left`/`right` slots and the
  `+1px` border-b offset. Collapsing it means adding those slots to `BrandMetalHeaderBar` and deleting
  `ModalMetalBar` + `HEADER_BAND_CLASS`. Not done: it touches the purchase modal's bar, and the plate
  numbers were already unified, which removed the part that could silently drift.
