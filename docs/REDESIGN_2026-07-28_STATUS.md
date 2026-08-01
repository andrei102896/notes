# Modal + dashboard redesign — status (2026-07-28)

Section-by-section reskin driven by fresh client Figma exports. Sections 1–28 are **committed**
(2026-07-30, "New redesign"); §29, §30 and everything under "Client Windows design fixes" below are
**uncommitted** working-tree state (user owns all git).
**`nn-extension-1.0.3.zip` is STALE** — it was packed from the tree as of 2026-07-31 *before* that section;
re-pack (`npm run pack`) before sending a build to the client.
**Suite: 75 tests / 24 specs — 75 passed, 0 failed (2026-08-01), the whole client round included.**

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
| 1 | Collapsed-note LINK/ANCHOR (heading gate REMOVED 2026-07-31 — see the Windows fixes below) | `hooks/useNoteLinkAnchor.ts`, `overlay/CollapsedNoteNav.tsx`, `overlay/Note.tsx` |
| 2 | Paid logo → NN updates page in a new tab | `lib/openInNewTab.ts`, `overlay/DashboardHeader.tsx` |
| 3 | Purchase-modal full-panel BG | `overlay/ModalBackdrop.tsx`, `overlay/PaywallDialog.tsx` |
| 4 | Dashboard modal BG behind every small modal | `NnModalShell` in `overlay/NnModalShell.tsx` |
| 5 | Universal delete confirm (467×189) | `overlay/DeleteConfirmModal.tsx`, `overlay/NnModalBox.tsx` |
| 6 | Empty state — first-run **and** deselected | `overlay/DashboardContent.tsx` |
| 7 | Add / rename subject tab (467×211) | `overlay/SubjectTabNameModal.tsx` |
| 8 | Blue notes scrollbar | `.nn-scrollbar` in `overlay/styles.css` |
| 9 | Blue metal brand band (logo plate only) | `BrandMetalHeaderBar` + `NnLogoPlate` in `overlay/BrandLockup.tsx` |
| 10 | Header bottom edge: 2px white + 3px accent + blurred shadow | `overlay/DashboardHeader.tsx` |
| 11 | Dynamic subject tabs, quantised to A–Z cells — **quantisation REMOVED 2026-07-31**, hook deleted | `overlay/SubjectTabStrip.tsx` |
| 12 | `+` button: **3px** white border, fills one A–Z cell, glyph **71%** of the blue box's width | `overlay/AddSubjectTabButton.tsx`, `overlay/SubjectTabStrip.tsx`, `.nn-…[data-add-tab-glyph]` in `overlay/styles.css` |
| 13 | Panel outer border → accent blue | `overlay/App.tsx` |
| 14 | A–Z index letters 26px → 24px | `--text-air-letter` in `overlay/styles.css` |
| 15 | Logo plate: FULL bar height, flush to the panel/modal OUTER top, non-scaling rim | `METAL_BAR_PLATE_CLASS` in `overlay/BrandLockup.tsx`; `overlay/DashboardHeader.tsx`, `overlay/NnModalBox.tsx`, `overlay/ModalBackdrop.tsx` |
| 16 | Rename subject tab (`RENAME SUB TAB MODAL 25-CHARACTER`) — verified, no code change needed | `overlay/SubjectTabNameModal.tsx` via `SubjectTabRenameDialog` |
| 17 | Subject tab names keep upper **and** lower case (still true; sizing is CSS now) | `overlay/SubjectTabStrip.tsx` |
| 18 | Scrollbar: 8px right gutter + pill ends | `.nn-scrollbar` in `overlay/styles.css` |
| 19 | Footer = the header band (same bar, plate and rim); copyright line dropped | `overlay/DashboardFooter.tsx` |
| 20 | Subject tabs: 3-cell floor dropped, length = character count — **superseded 2026-07-31**: no cells at all, `w-max` | `overlay/SubjectTabStrip.tsx` |
| 21 | Lateral shadow down the panel's left edge (`SHADOW UNDER AI BOXES`) | `content/overlayShell.ts` |
| 22 | Real NN updates URL wired to the paid-state logo (was a placeholder) | `overlay/DashboardHeader.tsx`, `tests/e2e/brand.spec.ts` |
| 23 | Plate narrowed 3.5:1 → **3.1:1** (client: a little wider than ADD NOTE), still flush | `NN_PLATE_ASPECT` in `overlay/BrandLockup.tsx` |
| 24 | Purchase plate == dashboard plate in **size AND proportions** (its own artwork, same box and same rendered NN) | `overlay/ModalBackdrop.tsx`, both compared directly in `tests/e2e/paywall.spec.ts` |
| 25 | Modal backdrop bar carries the DASHBOARD plate, not the purchase one | `plate` slot on `ModalMetalBar`, passed by `overlay/NnModalShell.tsx` |
| 26 | Review-fix pass: version sync, NUL-byte source file, dead classes/params removed, plate numbers derived from one place | `package.json`, `hooks/useSubjectTabCellSpans.ts`, `overlay/BrandLockup.tsx` + specs |
| 27 | NN ink back to the artwork's 52.5% width share — the horizontal counter-scale made it bulky | `overlay/BrandLockup.tsx`, `overlay/ModalBackdrop.tsx` |
| 28 | Headed e2e window parked off-screen so runs stop covering the desktop | `tests/e2e/fixtures.ts` |
| 29 | Nav strip `padding-bottom` 3px → **1px** so the white frame reads even on all four sides (the header's 2px `border-b` stacks under it) | `overlay/DashboardHeader.tsx`, `tests/e2e/nav-strip-frame.spec.ts` |
| 30 | Final subject tab closed by an outer 1px shadow (a border paints *inside* the box, so it reads short) — still live. The `--air-cell-drift` grid alignment in the same section is **GONE 2026-07-31**: the client dropped A–Z alignment | `overlay/SubjectTabStrip.tsx`, `overlay/styles.css`, `tests/e2e/subject-tab-sizing.spec.ts` |

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

0. ~~**Collapsed note: should ANCHOR always show?**~~ **ANSWERED by the client's full board (2026-08-01),
   "COLLAPSED NOTE CONCEPT":** *"ANCHOR BUTTON WILL ONLY APPEAR IF AN ANCHOR HAS BEEN SET"*, and the arrow
   marks the top pair "HERE ONLY" while the blue pair below is labelled CONCEPTUAL. Shipped behaviour (LINK
   always, ANCHOR only once set) is correct — do not change it.
0b. ~~**CONFLICT — note-body background**~~ **RESOLVED 2026-08-01: light body, blurred logo only.** The
   client's full board shows the dashboard's note bodies light, with product photos and black text, and the
   "NOTE LOGO BG" arrow pointing at a faint NN on that light surface — so "use the blurred logo for note
   background" means the artwork, not the modal's dark treatment. The dark version (built one round earlier
   from a CREATE-box crop) is reverted: the body is `bg-note` with #464646 text again, and the only change
   from the pre-sprint state is `blur-[0.390625rem]` on the existing watermark.
0d. **Product photos in notes.** The board's dashboard shows notes containing product images. Pasting an
   image works today, but there is no dedicated "add image" affordance — that would be a feature, not a
   design tweak.
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
   **Re-opened and re-closed 2026-07-30 (Windows):** the square was tried again and rejected again, this
   time because the leftover cell space has to be painted *something* and every option breaks the white
   frame — transparent shows the host page (the 2026-07-28 objection), white reads as extra padding on one
   axis, grey reads as a grey frame. **Fills the cell — final.** The crushed-glyph symptom that prompted
   the re-open was a separate bug (width-only sizing, trap 2b) and is fixed independently. The first-run
   `+`, which has no cell to fill, IS square now.

## Windows pass (2026-07-30) — READ BEFORE PULLING ON THE MAC

The whole sprint above was built and calibrated on the Mac (Retina, dpr 2). This pass was the first time
the app was run on Windows at **100% scaling (dpr 1)** in a **short/landscape** window, and it surfaced
three real `+` button defects that were structurally invisible to the Mac and to the e2e suite.

### ⚠️ Action required on the Mac — DONE 2026-07-31, see "Mac verification pass" below

**Regenerate the visual baselines** (`npm run test:e2e:update`, calibration machine only) and eyeball each
PNG. `first-run.png` and `full-panel.png` genuinely changed — the first-run `+` was resized. They were NOT
regenerated on Windows because the suite is Mac-calibrated (see `tests/e2e/README.md`).

### What was fixed

| Defect | Cause | Fix |
|---|---|---|
| `+` glyph clipped and off-centre | A Windows-only `viewBox="0 -1 24 24"` "recentring" hack. It never recentred anything — flexbox already centres the `<svg>` box — it slid the crop window down over a static path, blanking the top and **clipping the bottom tip of the vertical bar** (SVG clips to viewBox). | Deleted; both platforms use `0 0 24 24`. `src/lib/platform.ts` (`IS_WINDOWS`) was its only caller and is gone. |
| `+` glyph crushed top and bottom | `[data-add-tab-glyph]` was `width: 71%` with **no height constraint**. The cell is `--air-cell` (`100vh/26`) tall against a fixed-width column, so on a short/landscape window it is WIDER than tall and 71%-of-width made the square glyph taller than its box. Measured 1.75px of blue top/bottom vs 3.25px at the sides at a 620px window. | Added `max-height: 71%`, so 71% applies to whichever axis is tighter. The svg's viewBox ratio keeps it square. |
| First-run `+` lopsided | Sized `41×39` (Figma "Rectangle 28") — wider than tall around a square glyph, giving 5.5px of blue at the sides vs 4.5px above. Also threw off optical centring against the sentence. | Square (`size-[2.5625rem]`). Supersedes the Figma value; the spec assertion changed with it. |

Also added: `--air-cell-snapped` (`lib/panelScaling.ts` → `content/overlayMetrics.ts`) rounds the `+` cell to
whole **device** px so its white border rasterises evenly. A `translateX(0.5px)` optical nudge on the strip
glyph was added here too and **reverted on the Mac** — see below.

### Mac verification pass (2026-07-31)

Pulled on the calibration machine, baselines regenerated, every fix re-measured in painted pixels at dpr 2
across 760×700 / 760×620 / 1000×700 / 1280×800 / 1400×900.

| Windows fix | Holds at dpr 2? |
|---|---|
| `viewBox` back to `0 0 24 24` | Yes, no change — the painted `<path>` ink fills the `<svg>` box exactly on both axes (33×33 device px in a 16.44 css-px square at 1400×900). The Mac never had the clip. |
| `max-height: 71%` | Yes. At 760×620 the height axis is the binding one (glyph 72% of the content height vs 57% of its width) and the blue above/below is 5 device px — the crush the cap exists for cannot happen. On a tall window the width still binds, unchanged. |
| First-run `+` square | Yes. 28.69 css square, glyph 34×34 device px, blue gap **7 device px on all four sides** (`B20 W6 B7 W34 B7 W6 B18` on both axes at 1400×900), centre exactly level with the sentence (0.00px). |
| `--air-cell-snapped` | **Kept.** Neutral-to-positive at dpr 2: identical painted interior everywhere, and it removes a 1-device-px glyph-gap asymmetry at 760×620 (5/5 snapped vs 5/6 raw). Cheap, no regression. |
| `translateX(0.5px)` | **Reverted.** Measured at dpr 2 it *creates* the bias it was meant to remove. |

The nudge, blue gap left/right of the glyph in device px:

| Viewport | with nudge | without |
|---|---|---|
| 760×700 | 8 / 6 | **7 / 7** |
| 760×620 | 10 / 9 | 9 / 10 |
| 1000×700 | 8 / 6 | **7 / 7** |
| 1280×800 | 7 / 6 | 6 / 7 |
| 1400×900 | 8 / 6 | **7 / 7** |

Without it the glyph is exactly centred at three of five viewports and off by one device px at the other
two; with it, it is never centred and is two device px right at three of them. A single constant cannot be
right at both dpr: the remainder flex centring has to round is set by the box width, which rides the panel
width continuously — so a value tuned by eye at one dpr and one window size is wrong everywhere else. The
residual ±1 device px is that remainder and no constant removes it.
`subject-tab-sizing.spec.ts` went back to asserting `|gapLeft - gapRight| < 0.5`.

### Windows-only test noise (do not chase these on the Mac)

These fail on Windows and were verified pre-existing by stashing all changes and rebuilding clean:
`nav-strip-frame` (3px vs 2.6px), `rename subject tab modal` (text selection returns `""`), `metal-bar`
(5px vs 4.8px, 2px vs 1.6px) and all six `visual.spec.ts` baselines (~1–6% antialiasing diff). `keep the
case`, `delete confirm modal` and `label padding` are **flaky under parallel load** — each passes in
isolation. Windows dev setup: system Node was 14, too old for Vite 5 / ESLint 9; Node 20 was installed via
nvm-windows to `C:\nvm4w\nodejs`.

## Deferred work

- **Full suite: 75 passed, 0 failed (2026-08-01).** All six `visual.spec.ts` baselines were regenerated and
  reviewed on that run; they had already been refreshed several times through the client round.
  Three specs needed repointing when the round closed, all describing the OLD build rather than a
  regression: `metal-bar` read the accent line off the header's `box-shadow` (it is an element now),
  and `brand` + `subject-tab-sizing` ran with zero subject tabs, where the first-run backdrop covers the nav
  row and the strip — the badge was unclickable and the `+` pixel scan read the backdrop. Both now create a
  tab first.
- **Known flake: `subject-tab-sizing` → "label padding is one character at each end".** Failed once in a full
  run, passed in isolation and in every run since. Same profile as the flakes recorded in the Windows pass.
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
`ModalMetalHeaderBar` are now module-private (single in-file caller each). `IS_WINDOWS` and
`src/lib/platform.ts` are gone entirely (2026-07-30): the lockup's Windows padding nudge died with the
lockup, and the `+` viewBox hack it also gated was a bug, not a tweak.

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
| flanking boxes | `HEADER_BOX_CLASS`, one export in `BrandLockup.tsx` shared with `ModalMetalBar`: `relative` + `border-[0.5px] border-accent-deep` + `bg-accent/[0.86]` + `inset 0 -18px 11.2px 3px rgba(0,0,0,0.28)`. `relative` is load-bearing — a static band paints under the absolute hilite and washes out to near-white | Figma `UPDATE____HEADER BOX`; client 2026-07-31 |
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
2b. **Corollary (2026-07-30):** because the cell's height rides the viewport and its width does not, the
   cell **flips aspect ratio** with the window — taller than wide on a tall window, wider than tall on a
   short/landscape one. Anything sized off one axis alone (`width: 71%`) breaks on the other. Constrain
   both axes, and test at a short window.
3. **`scrollWidth` lies on tabs.** `TabsTrigger` has an invisible `after:` indicator at `-right-1`,
   which inflates `scrollWidth` by ~3px on every tab. A `scrollWidth > clientWidth` clipping check
   reports false positives; measure the label with canvas against the content box instead.
4. **A tab's bounding box is not where the tab is painted.** The trigger is square and rotated about
   its top-left, so `boundingBox()` returns that same square: only its *vertical* extent is the tab's,
   while half its width hangs outside the strip, which clips it. Scanning pixels at
   `box.x + box.width / 2` samples the notes list and can pass for the wrong reason — take x from the
   strip, y from the tab.
5. **A border cannot close a tab.** Borders paint *inside* the box, and every A–Z grid line paints
   *below* its boundary (it is the next cell's `border-t`), so a closing `border-r` lands 1.5px above
   the line it must match — the client reads that as "the tab is a few pixels short". Use an outer
   `box-shadow`, which paints past the edge like the neighbouring cell's border would. Related: the
   `+` cell is device-snapped while the A–Z column is not, which put the whole strip ~0.12px off the
   grid; `--air-cell-drift` (styles.css) added that back below the `+`. **Both the drift variable and the
   alignment goal were dropped 2026-07-31** — tab edges no longer meet the A–Z lines by design. The rest of
   the trap (a border cannot close a tab; use an outer shadow) still holds.
6. **Element screenshots, not page screenshots,** for artifacts — a full-page shot can catch the
   overlay mid slide-in (or after slide-out) and come out shifted or blank.
7. **Assert what you claim.** A "does hiding it change one pixel" check passed on a ghost logo that
   was humanly invisible. The test now measures the *fraction* of pixels that visibly change (>5%).
8. **The e2e fixture freezes the page clock** at `FIXED_NOW` (2026-07-02). Seed the trial from the
   service worker's real clock, or an "active" trial reads as long expired.
9. **Custom properties defined on `#host` do NOT reach portaled dialogs.** `--air-cell` lived on
   `#nn-scroll-bookmarks-overlay-host`; every modal portals into the iframe `body`, outside it. Setting
   the purchase bar to `h-[var(--air-cell)]` there produced a **57px** bar instead of 34.6, because the
   `height` resolved to `auto` and the layout degenerated silently — no error, no warning. `--air-cell`
   now lives on `:root` (`styles.css`). Anything a modal may need must be declared at the root.
10. **Measure text in the document that owns the element.** (`useSubjectTabCellSpans` is deleted, but the
   rule holds for any canvas measurement.) That hook built its canvas
   with the content-script realm's `document`, which has no Fjalla One — every label was measured with
   fallback metrics (~35% too wide), so a 9-character tab claimed 4–5 A–Z cells instead of 3. Use
   `container.ownerDocument.createElement("canvas")`. `document.fonts.check()` on the iframe's font set
   said "loaded" while the canvas silently used the fallback, so the guard hid the bug rather than
   catching it. (Also: `check()` returns true for any family list containing a generic like `sans-serif`
   — check the first family alone.)
11. **A caller's `items-center` shrinks a bar to its content.** `SubjectTabNameModal` passes
   `items-center` to `NnModalBox`; the metal bar (a flex-column child) collapsed to the plate's 87px
   instead of the box's 336px, which is what the client saw as "no metal left and right of the logo in
   the modals". The bar carries `w-full` so no caller can do that again.
12. **Element screenshots still need the slide-in to finish.** A header-band artifact taken immediately
   captured the band still translated, so the host page showed past the iframe edge as a grey stripe
   over the bar's right 13% — a pure artifact, while `elementFromPoint` reported accent blue there.
   Wait for the panel before screenshotting, and confirm suspicious artifacts against the DOM.

### Added by the Windows pass (2026-07-30)

13. **Layout geometry is not what the user sees — measure painted pixels.** `getBoundingClientRect` and
   `getComputedStyle` reported the first-run `+` as perfectly even (`gap L/R/T/B = 3.638/3.650/3.638/3.650`)
   while the rendered result was ~3.5px vertical vs ~4.1px horizontal. Fractional box sizes, border
   rasterisation and antialiasing all move the visible edge. Screenshot at `deviceScaleFactor: 4`, decode
   raw pixels, and walk runs of white/accent. The client's eye was right every time it disagreed with CSS.
14. **Never clip a screenshot exactly to `boundingBox()`.** Playwright's clip is in CSS px and gets rounded,
   so a fractional-width element loses its right/bottom edge — which produced "the border is 1px on the
   right, 2.25px on the left" out of a box whose borders are provably uniform. Clip with padding and find
   the element inside the image. This cost several rounds of chasing a measurement artifact as if it were
   a bug.
15. **Sweep dpr AND window size before committing a pixel fix.** Snapping the `+` cell to whole CSS px
   improved dpr 1 (Δ 0.34 → 0.20 device px) and **regressed dpr 2** (Δ 0.04 → 0.40) — it had to be whole
   *device* px (34.5 at dpr 2, not 35). Build a throwaway script that loops candidates × dpr × viewport and
   prints a table; do not reason about sub-pixel rasterisation from first principles.
16. **`aspect-square` cannot shrink a definite dimension.** `h-full aspect-square max-w-full` does nothing:
   `h-full` makes the height definite, so aspect-ratio has nothing to solve for and the max-width clamp
   never feeds back. Use an explicit `min()` on both axes.
17. **`npm run dev` (CRXJS) leaves `dist/` as thin loaders** that stream code from the localhost dev server,
   so what the browser shows depends on the page being re-injected — and survives the dev server being
   killed. Two separate "your change did nothing" reports traced to a stale build showing a version that
   had already been discarded. For a clean verification loop: stop the dev server, `npm run build`, Reload
   in `chrome://extensions`, reload the page, and grep the bundle to prove the value shipped (CSS is
   minified — `max-height: 71%` becomes `max-height:71%`, and lengths lose their leading zero).
18. **`AddSubjectTabButton` renders twice** — the subject-tab strip and the first-run modal, each sized by
   its own caller. Identify which one a screenshot shows before measuring; a complaint that is accurate for
   one is impossible for the other, which reads as the report contradicting itself.
17. The ghost NN PNG (`src/assets/ghost-nn.png`, base64 in `ghostNnPng.ts`) has **max alpha 41/255** —
   it was not flattened with its Figma blend. It reads only because it sits over the square glow. A
   re-export with the blend baked in is a `cp` + regenerate away.

### Added by the Mac verification pass (2026-07-31)

19. **A constant sub-pixel "optical nudge" is a machine-specific hack — measure it at both dpr before
   keeping it.** `translateX(0.5px)` recentred the strip `+` on Windows at dpr 1 and pushed it two device px
   right on the Mac at dpr 2. The offset it corrects is the remainder flex centring rounds, and that
   remainder is set by the box width, which rides the panel width continuously — no single constant is right
   across dpr and window size.
   **Resolved 2026-08-01 — the ±1 is gone, but only because the correction is COMPUTED, not constant.**
   `useSymmetricAddGlyph` reads the box on the device grid and forces an even leftover per axis, so the
   warning above still stands for any fixed nudge. It shipped gated to fractional dpr; the Mac then measured
   3 of 16 axis checks off at a clean dpr 2, so the gate came off — the defect is odd-parity, not dpr-specific.
   Verified on the Mac at dpr 2 and dpr 1: 8/8 widths symmetric on both axes, all six visual baselines
   unchanged. At 1400×900 (the fixture default) the painted gaps are identical to before, which is why no
   baseline moved; the glyph's share of the box reads 71.3%/57.9% vs 71.0%/57.6% before.
20. **`--air-cell-snapped` is an inline property on the iframe root**, set by `syncOverlayViewportMetrics`.
   A stylesheet rule cannot override it for an experiment; `documentElement.style.removeProperty` can, and
   the next resize puts it back.
### Added by the client round (2026-07-31 → 08-01) — full text in `AGENTS.md` §8

22. **`text-box: trim-both cap alphabetic` centres GLYPHS, but only on the element that owns the text.**
   Works on an `<input>`; a no-op on a flex container (its text is an anonymous item). Hence
   `.nn-label-center` = trim + `display:block` + `align-content:center`, and `.nn-cap-trim` for inputs.
23. **`bottom` on an absolute child is measured from the parent's PADDING box** — the blue line sat 2px high,
   over the header's own white border, until the offsets carried `calc(9px + …)`.
24. **A negative z-index child still paints above its parent's background and box-shadows.** The blue-line
   shadow band could only be got out of the way by DOM order, not by `-z-10`.
25. **An `absolute left-1/2` box with no width shrink-to-fits against half the container.** That is what
   squeezed the purchase modal's square grid to 49.6% of the panel and smeared its columns together.
26. **Radix `DialogContent` always paints a `bg-black/80` overlay under itself** — invisible under an opaque
   backdrop, a visible dimming flash without one. `showOverlay` (`components/ui/dialog.tsx`) disables it.
27. **A `sticky` element with a z-index is its own stacking context**, so a descendant (the trial badge)
   cannot be raised above a sibling of that element (the first-run backdrop).
28. **Runtime style sweeps must use the class's UNIT.** A `bottom` sweep in absolute px against a rem class
   measured a geometry that never ships — rem is panel-scaled here (root ≈ 11.7px at the test panel).
29. **Which "+" a test may click depends on state that arrives ASYNCHRONOUSLY.** The first-run panel mounts
   after a storage read, so `createSubjectTab` resolving the target once could aim at the strip's `+` a beat
   before the backdrop covered it — the click landed on the backdrop, no dialog, and the spec timed out at
   90s. It only reproduced in full-suite runs (two anchor specs), never in isolation. The helper now
   re-decides and retries up to three times; if a test ever hangs waiting for `[data-slot="dialog-content"]`,
   this is the shape of it.

21. **`page.screenshot({ clip })` silently clamps a negative origin and drops rows unevenly.** The strip `+`
   sits at `y = 0`, so `y: box.y - PAD` goes negative and the returned image is neither the requested height
   nor a predictable crop — which reads as "the element is all white". Clamp the origin to 0 and add the
   difference back to the size (this is trap 12's sibling, at the other edge).

## New tests

| Spec | Covers |
|------|--------|
| `tests/e2e/paywall.spec.ts` | Purchase modal fills the panel, its plate AND its rendered NN ink both equal the dashboard's (all measured in the same DOM, so the rule cannot silently drift), plate flush to the outer top, trial + BUY boxes carry the Figma outline/bg/inset and the 184.34×30 box, trial box centred, ghost NN visibly present (canvas pixel-diff ratio, logged), Escape + BUY dismiss |
| `tests/e2e/modal-backdrop.spec.ts` | Dashboard backdrop behind rename; **its bar carries the same plate artwork as the modal box's bar** (viewBox + stroke compared — the visual baselines cannot see this, the plate is small enough to stay under `maxDiffPixelRatio`); delete confirm holds 467×189; empty-state shell; first-run `+`; name modal fixed field + 25-char cap; rename modal label/prefill/selection + Figma sizes as root-font shares |
| `tests/e2e/subject-tab-sizing.spec.ts` | Length follows the character count with no floor (box ≥ label+padding, < that + one cell; strictly grows with the label), spans whole cells, 1-character padding, 25-char name not clipped, case preserved, **every tab edge (4 tabs, 4 different spans) is a 1px white line on the same device row as the A–Z line beside it** — scanned in both columns at the same y, which is the only way to catch a line that is present but 1.5px high, `+` fills its cell with zero margin + even border + centred glyph |
| `tests/e2e/metal-bar.spec.ts` | Plate spans the full bar height (zero top/bottom gap, metal left/right, centred), flush to the panel's OUTER top, 3.1:1 box, 1–1.55× the ADD NOTE button, **NN ink covers 52.5% of the plate width / 49.4% of its height and is centred on both axes**, rim equal on 4 sides + gradient that never steps, no black seam between header rows, 4px accent bottom line, footer bar identical to the header |
| `tests/e2e/scrollbar.spec.ts` | Notes list gets `.nn-scrollbar`, an 8px right gutter (pixel-verified, since `background-clip` is what makes the transparent border visible), and pill ends measured by row-width taper with the thumb parked mid-track |
| `tests/e2e/panel-shadow.spec.ts` | The panel's left-edge shadow, scanned in host-page pixels: darkest at the edge, monotonic fade to ~85px, present at the top and bottom of the edge as well as mid-panel |
| `tests/e2e/session-persistence.spec.ts` | 7 tests for the 2026-07-31 behaviour work: the client's exact Back sequence (bfcache path, stale panel measured in painted frames), the same on a bfcache-ineligible page (`unload` handler; zero frames painted, which is what the pre-mount buys), the inverse (maximized survives Back), a forward navigation to a third site, the slide (frame-by-frame travel, no veil element), the reveal cap on a page whose subresource hangs, and notes being current after Back |
| `tests/e2e/session-persistence.live.spec.ts` | The same Back/slide scenarios against **real** sites (`npm run test:e2e:live`, network required, excluded by default). Sites are two constants at the top of the file; ford.com + bugatti.com as committed |
| `tests/e2e/metal-bar-layers.spec.ts` | The metal bar's LAYER look, header and footer, from the client's crop rather than their Figma CSS: deep top line, a sheen that never reaches the raw hilite colour, peak in the top 45%, monotonic fade, plate ≥1.5× the band's luminance, a darker seam between band and plate. Verified to FAIL on the pre-fix build |
| `tests/e2e/blue-line.spec.ts` | The blue line under the nav bar: 4px accent (every device row, or the dark band's blur is washing it), the 3px white bar, the shadow stuck to that bar, and a second test that the shadow dies in the gap and leaves the first note's border unwashed |
| `tests/e2e/paywall-statement.spec.ts` | The purchase STATEMENT box (four paragraphs verbatim, width share, height in rem, bg alpha, 0.3px hairline, Familjen Grotesk 17/21, symmetric top/bottom padding in painted pixels) and the BG SQUARES spreading across the panel (grid ≥75% wide — it measured 49.6% before the fix — with blue painted in all three thirds) |
| `tests/e2e/first-run-swap.spec.ts` | Clicking the first-run "+" swaps the box: one backdrop and one box at all times, and a backdrop pixel sampled every frame must not move in either direction (lighter = it unmounted, darker = Radix's dimming overlay landed) |
| `tests/e2e/nav-strip-frame.spec.ts` | The nav strip's white frame: `padding-bottom` 1px + the header's 2px `border-b` = the 3px the other sides get from padding, then the painted proof — a 1px column through ADD NOTE must show the same run of white above and below it (the padding and the border merge into one band, so only pixels can tell 3px from 5px) |

`tests/e2e/functional.spec.ts` and `brand.spec.ts` also changed: two brand tests were **deleted** (they
hunted the removed wordmark) and the surviving font test was repointed twice — first off the deleted
"Notes for Net" spans, then off the footer's copyright line when the footer became a copy of the header.
It now reads a note's URL/date row, the only `font-ui` surface left. `brand.spec.ts` also gained the
NN-updates test (routes the URL to a stub; seeds an expired trial to reach the off-trial branch, since the
default e2e state starts a fresh local trial and shows the red logo instead).

Run a section's own spec after each change (`npx playwright test <spec>`); artifacts land in
`test-results/<test>/*.png` and are the review currency with the user. **`npm run test:e2e` takes ~3
minutes and is worth running before any handoff** — the suite is 75 tests / 24 specs.

## Client feedback 2026-07-31 — behaviour, not design (SHIPPED, uncommitted)

Two items from Brian, both about navigation rather than looks. Full model in `AGENTS.md` §5; the
"why it cannot be more than this" answer lives there too.

1. **Min/max was not persistent.** Minimize NN on page B, hit Back → page A came back with NN maximized.
   Two independent causes: a **bfcache** Back never re-runs the content script (the frozen DOM, panel
   included, is repainted as-is), and the **open-hint is per-origin**, so page A's hint still said "open".
   Fixed by a `pageshow`/`persisted` re-sync plus demoting the hint to a *pre-mount only* signal
   (`premountOverlay`). A `navigation.type === "back_forward"` guard was tried first and is **wrong** —
   that timing entry is empty when the content script runs (see the traps section).
2. **The fade-back was inelegant.** The frosted veil (`loadingVeil.ts`, 1s hold + 300ms fade) is deleted;
   the cross-origin restore now slides in over 300ms once the panel has painted, capped by
   `PANEL_REVEAL_CAP_MS` (700ms) so a slow site cannot strand it.

Also added: `TAB_RESTORED_EVENT` → `useNNDashboardSession` re-reads storage on restore. **Measured to be
belt-and-braces**: Chrome queues the extension's `storage.onChanged` while the page is frozen and flushes
it on unfreeze, so notes are current after Back either way. Kept deliberately (explicit guarantee), but the
test covering it passes with or without — do not read it as a regression test for that code.

Two suspected races were investigated with timestamp traces and proved **unreachable**, and the guard
written for them was deleted: nothing is on screen while a reveal is pending (so a hide cannot be undone),
and the anchor gate resolves in ~800ms, before any toolbar message can arrive (≥1s).

Verified on real sites, not just stubs (`npm run test:e2e:live`): ford.com, tesla.com, bugatti.com and
framed-shot.com are all **bfcache-ineligible**, so the real-world path is the rebuilt-page one; NN returns
in ~300–670ms end to end, nearly all of it the page's own load.

## Client Windows design fixes (2026-07-31, in progress — one item at a time)

The client tested the packed build on Windows and sent design fixes. Scope rule for these: fix the
element the item names and nothing else, and run only the specs covering it.

1. **"Centre words vertically inside buttons"** (screenshot: the delete-confirm modal) — the delete
   modal's CANCEL/OK. `align-items: center` centres the *line box*, and Fjalla One's metrics are
   asymmetric (ascent 1.009em vs descent 0.248em), so the caps paint ~1–1.5px above the box centre at
   every size and window. Fixed with `.nn-label-center` (`overlay/styles.css`): `text-box: trim-both cap
   alphabetic` trims the line box to cap-height/baseline so the *ink* is what gets centred, plus
   `display: block; align-content: center` because trim never reaches a flex container's text (it sits
   in an anonymous item that inherits no trim — measured as a complete no-op). Font-derived, so it needs
   no `IS_WINDOWS` gate: measured in painted pixels at dpr 1 **and** 2, at 1400×900 and 760×620, the
   off-centre went 1.0–1.5px → 0–0.5px (the residual is the ±1 device-px parity floor, per trap 19).
   Same class fixes the add/rename modal's CANCEL/OK and the header/note-action labels, which have the
   identical defect (1.5px and 1.0px) — deliberately NOT applied, awaiting the client.
2. **Subject tabs: one character of padding each end, and STOP quantising to A–Z cells** (client: "'before'
   padding good, 'after' padding too much — do not try to line it up with alpha index boxes"). The excess
   *was* the round-up to whole `--air-cell` multiples: the label is pinned to the start, so all of it landed
   after the text (`GOLF` = 69px box for a 49.5px need → 19.5px dead space). The tab is now sized by its own
   content — `w-max aspect-square` on the trigger (`SubjectTabStrip.tsx`), `aspect-square` keeping
   height === width for the rotation constraint. Slack is max-content's ~1px; painted blank measures
   ~10.5–12px before vs ~9.5–11px after against 1ch = 9.1px. **This supersedes §11, §20, §30 and trap 5's
   grid-alignment goal**: `useSubjectTabCellSpans` (and its canvas/font-timing machinery, trap 10) is
   deleted, as is `--air-cell-drift` and the strip's compensating `mt-`. `subject-tab-sizing.spec.ts` had two
   tests asserting the old rule; both were retargeted (no cell rounding; edges are 1px white lines but are no
   longer compared to the A–Z rows) and `full-panel.png` was regenerated.
3. **Collapsed note: LINK/ANCHOR no longer gated on a typed label** (client: "do not make LINK/ANCHOR
   visibility contingent on user adding text… keep it obvious no matter what"). `Note.tsx` rendered
   `CollapsedNoteNav` only when `note.heading.trim() !== ""` (§1) — now on `!expanded` alone. ANCHOR still
   appears only once an anchor is picked, which is independent of the label; flagged to the client. The same
   item asked for the label to be centred vertically: the title `Input` got `.nn-cap-trim` — the trim
   **does** reach an `<input>`'s inner editor (measured 1.00 → 0.25 css px high at dpr 2, and exactly even
   at dpr 1), which is why the trim is now its own class and `.nn-label-center` only adds the block/centring
   an `<input>` must not have.

4. **First run = the full-panel NN backdrop, not the grey dashboard** (client: "we have the old initial tab
   background, it should be like in the 2nd img" — the img being the `DASHBOARD MODAL BG` artboard with the
   467×189 box on it). New `overlay/FirstRunPanel.tsx` composes what `NnModalShell` does (`ModalBackdrop` +
   `ModalMetalBar` with the dashboard plate, `showTagline={false}`, box centred) but **not** as a Radix
   dialog — there is nothing to dismiss and a focus trap would fight the add-tab dialog its "+" opens. It is
   the last child of App's `<main>` at **z-40**, which is what clears the header row (z-20) and the strip's
   "+" (z-30); at z-auto both floated on top of the backdrop. `DashboardContent` no longer knows about
   `first-run` (its prop is now `"select-or-create" | null`, and `onRequestAddSubjectTab` moved to App).
   **Decided 2026-08-01 — the backdrop covers everything, header included (`z-20`, i.e. unchanged).** The
   first-run screen must match the client's render, full stop: "trebuie sa arate ca in design". A `z-50`
   header was tried for one round so the trial/NN badge would stay reachable, and it was rejected on sight —
   with the header above the backdrop the nav row is inset by the A–Z + strip columns while the backdrop's own
   bar runs full width, so the row reads as indented with dark backdrop beside it.
   **Known cost, accepted twice:** the badge is the only route to the BUY modal, and with an expired trial the
   `+` is `disabled={isReadOnly}` in both copies, so a user whose trial runs out before creating any tab can
   neither buy nor create. Do not "fix" this unasked.
   For the record, raising **just the badge** is impossible: the header is `sticky` with a z-index, i.e. its
   own stacking context, so no z-index on a descendant can beat a sibling of the header. The only ways to keep
   purchase reachable without a nav row are to put a badge in the panel bar's own `right` slot (the purchase
   modal already does exactly that) or to lower the backdrop — both deviate from the render.
   `paywall.spec.ts` therefore creates a subject tab before reaching for the badge.
   Test fallout: the shared `createSubjectTab` helper now prefers the box's "+" (the strip's is behind the
   backdrop), two `functional.spec.ts` tests and two `modal-backdrop.spec.ts` tests were repointed the same
   way, and `visual.spec.ts`'s first-run baseline captures the whole panel instead of the content area.

5. **Dashboard header + footer: the flanking HEADER BOXes now read as a layer** (client: "missing layer
   either side of logo that makes logo pronounced — got it right on the modals"). They were always in the
   DOM; the defect was **paint order**. The bar's white hilite is absolutely positioned, so the dashboard's
   *static* bands painted UNDER it and washed out to near-white (measured column: `158,226,255` at 40% height
   vs the modal bar's `57,179,230`), while `ModalMetalBar`'s bands were `relative` and painted over it. The
   two copies of the band class had drifted — the modal's also had a `border-[0.5px] border-accent-deep`
   hairline. Now there is ONE `HEADER_BOX_CLASS` (exported from `BrandLockup.tsx`, `ModalMetalBar` appends
   only its own `flex items-center`), carrying both `relative` and the hairline, so the dashboard band, the
   footer and the small modal box's bar all match the backdrop bar. **Paint-only: every bar height and the
   plate box are byte-identical** (34.61 / 35.61 / 25.51 px before and after; `metal-bar.spec.ts` 4/4 —
   plate 3.1:1, NN ink 52.5%/49.4%, rim, flush-to-top, footer == header all still hold). Side effect worth
   confirming: the small modal box's bar changed too, since it shares the component.
   Baselines regenerated: `header.png` (its test now creates a tab first — on first run the new backdrop
   covered the nav row, making that baseline depict the wrong thing), `first-run.png`, `full-panel.png`,
   `add-subject-tab-modal.png`, `delete-confirm-modal.png`.
   **Client CSS received afterwards (`UPDATE____HEADER BOX RIGHT` + `WHITE HILITE ON TOP BAR`) and it
   confirms the fix.** Their band is `238×39`, `rgba(41,171,226,0.86)`, `inset 0 -18px 11.2px 3px
   rgba(0,0,0,0.28)` — our values byte for byte (ours in rem, which is why they scale). Their hilite is
   `606×14`, `#9EE2FF`, `blur(2.95px)`: 606 is the bar's full width (686 panel − two 40px tab columns), so
   `inset-x-0` is right, and 14 of 39 = **36%**, not the 40% we had → `h-[40%]` → `h-[36%]` (paint-only).
   The 0.86 alpha is the proof of paint order: with the hilite on top the bar's top reads near-white
   `#9EE2FF`, which is what the client rejected; under the band, 14% of it bleeds through as the top sheen.
   Their `238px` band also cross-checks the plate: at the 39px reference bar, `3.1 × 39 = 121px` leaves
   242.6px per band vs their 238 (their own numbers imply 3.33:1) — the client fixed 3.1 on 2026-07-29, so
   the plate ratio was left alone. The `border-[0.5px] border-accent-deep` hairline is NOT in their paste,
   but copy-as-CSS is known to drop strokes and the modal bar they call correct has it, so it stays — flagged
   for confirmation.
   **The look is now pinned by tests, not by the Figma** (`tests/e2e/metal-bar-layers.spec.ts`, header +
   footer): painted-pixel assertions taken from the client's crop — the bar's top row is a deep line
   (`lum < 120`), the band's brightest row is NOT the hilite colour (`#9EE2FF`, `lum 209`) and stays under
   `lum 175`, that peak sits in the bar's top 45%, the lower half fades monotonically, the plate's interior is
   ≥1.5× the band's luminance beside it, and a darker seam separates band from plate. **Verified to fail on
   the pre-fix build** (band peak measured exactly `158,226,255`, top row `86,182,223`), so it is a real guard
   rather than a green rubber stamp. New spec file because `metal-bar.spec.ts` was at 266 LOC.

6. **Trial modal: any click but BUY returns to the trial** (client: "clicked the logo to check time left…
   there is no way to go back to NN trial mode but am forced to purchase. Had to go through with purchase
   and then cancel"). It *was* dismissable — by Escape only, which nothing advertises: `DialogContent` is
   `h-full w-full`, so Radix has no "outside" to close on, and `showCloseButton={false}` is deliberate.
   Fix (explicit human approval, §7 file): one wrapper `div[data-paywall-dismiss]` around `ModalBackdrop`
   with `onClick={() => onOpenChange(false)}`. **No payment wiring touched** — `onBuy`, ExtPay and the trial
   math are untouched, and BUY's own handler already closed the modal, so its bubbling click changes nothing.
   `paywall.spec.ts` now also asserts a click low in the panel and a click on the trial box both dismiss.
   **This surfaced a real hole from item 4:** with zero subject tabs the first-run backdrop covers the nav
   row, so `[aria-label="Open trial info"]` cannot be clicked at all — an expired-trial user with no tabs has
   no route to BUY. The paywall spec now creates a tab before reaching for the badge, which keeps the suite
   honest but does not fix the product hole, which the client's design deliberately keeps (see item 4).

7. **BLUE LINE under the nav bar re-implemented for separation** (client: "not coming across as prominent as
   it needs to… the line includes a white drop shadow on the line itself set pretty tight [minimum blur] along
   with a blurred black solid below it in the stack"). The line was *there* — `getComputedStyle` reported a
   clean `0 4px 0 0 #29abe2` — but the `SHADOW __BLUE LINE` band (593×8, `rgba(55,55,55,0.77)`, blur 4.8px,
   which matches our CSS exactly) sat only 5px below the header, and a 4.8px Gaussian reaches ~7px, so its
   tail painted the accent line **44,146,190 instead of 41,171,226** and greyed the white border above it.
   Fixes, both paint-only: the missing tight white drop shadow is a second entry in the header's box-shadow
   list (`0 6px 1px 0 rgba(255,255,255,0.95)`, painted under the accent entry since the list draws
   first-on-top), and the dark band moved from `-bottom-[0.8125rem]` to `-bottom-[1.375rem]` (22px) so its
   blur starts below the white instead of over the line. Swept 19/22/25/28px in painted pixels — 22px is the
   first offset where all 8 device rows of the line read exactly the accent.
   Stack now, measured downward from the header's bottom edge: 8 device rows of accent (`41,170,225` →
   `42,163,214`, the last row an antialias blend into the white), a tight white pair (`238`), then the dark
   falloff to `158` against a `246` notes area.
   Pinned by `nav-strip-frame.spec.ts` → "the blue line separates the nav bar": every row of the line must
   keep `b ≥ 205` and `g ≥ 155` (the pre-fix wash fails both — verified by reverting: `44,146,190`, worst
   off 69), a white row above `lum 235` must follow it, and the dark band must sit ≥25 lum below the notes
   area. That spec's older frame test also needed a subject tab now, since the first-run backdrop covers the
   nav strip.
   **Revised the same day** after the client added a **white bar** under the line ("the shadow must be sticked
   to that white bar"). Final structure: the line and bar are no longer box-shadows on `<header>` but a
   `div[data-nn-blue-line]` (4px `bg-accent` + 3px `bg-white`, in **px** — the accent line is the client's 4px
   and must not thin out with the panel) rendered **after** the dark band, so the band's blur can hug the bar
   without tinting either. Box-shadows could not do this: a `<header>` shadow paints under every child, and
   negative z-index does not help (a negative-z child still paints above its parent's background and shadows).
   Note `bottom` on an absolute child is measured from the PADDING box, so both offsets carry the header's 2px
   `border-b` (`-bottom-[9px]`, `-bottom-[calc(9px+0.5rem)]`) — without it the line painted over the white
   border and the nav-frame test dropped to 1px.
   The band's blur landed on the first note (its accent border measured `47,126,159`), so per the client the
   notes list's top padding went `py-4` → `pt-6 pb-4`: the gap is now 17.5px, the shadow runs its full depth
   (darkest `134`) and fades to `163` before the card, whose border reads `41,169,223` of the accent's 226 —
   the two shadows merge in the gap instead of the header's landing on the card.
   Painted stack now: `41,171,226` ×4px, `255,255,255` ×3px, then the dark falloff. Pinned by the new
   `tests/e2e/blue-line.spec.ts` (moved out of `nav-strip-frame.spec.ts`, which was near the 300 cap): two
   tests — the line/bar/stuck-shadow one and "the shadow fades out before the first note", which asserts the
   gap is >15px, carries shadow (`lum < 180`) and leaves the note's border ≥205 blue.

8. **Purchase modal: the client's STATEMENT box, and the BG SQUARES fixed** (2026-07-31).
   - `STATEMENT BOX` (their CSS: 665×219, `rgba(41,171,226,0.1)`, `0.3px solid #29ABE2`, text 17/21 white):
     new optional `statement` slot on `ModalBackdrop`, filled only by `PaywallDialog`, pinned at 9% of the
     inner frame with a `13.6875rem` height (= 219px at the 16px reference root, so it scales). Chrome floors
     the 0.3px hairline at 0.5px — that is its minimum visible border, not a mistake.
     **Font:** their type panel says *Familjen Grotesk Regular 17*, which the extension did not bundle;
     `FamiljenGrotesk-Regular.ttf` (55 kB, SIL OFL 1.1, from Google Fonts) is now bundled exactly like Fjalla
     One and Inter, exposed as `--font-statement`, and CRXJS adds it to `web_accessible_resources` on its own.
     Replace the file if the client prefers their own copy.
   - The statement forced a **second layout branch**: their render DECOUPLES the ghost NN (rides the frame's
     top, half of it behind the box) from the wordmark and tagline (~42% / ~53% of the panel). The existing
     grouped layout pins both texts to percentages *of the ghost box*, so it cannot express that; the
     no-statement path (every dashboard modal) is untouched, and `BrandWordmark`/`Tagline` were extracted so
     the two branches cannot drift.
   - **BG SQUARES were a layout bug, not a styling one.** As `absolute top-1/2 left-1/2` with no width the
     grid shrink-to-fits against what remains of the container — half its width — so the three 112px columns
     were squeezed into 248px of a 500px panel and overlapped into one vertical smear down the middle ("looks
     nothing like the design"). Wrapping it in an `inset-0` flex centring container gives it its natural
     width: now 82% of the panel, three distinct columns, blue reaching both outer thirds.
   - Pinned by the new `tests/e2e/paywall-statement.spec.ts` (own file, `paywall.spec.ts` is at the cap): the
     four paragraphs verbatim, the box's width share/height-in-rem/position/bg-alpha/hairline/font/size, then
     the grid's 15 squares, ≥0.75 width share (it measured **0.496** before the fix) and painted blue in the
     left, middle and right thirds. All six visual baselines regenerated.

9. **First run: "+" SWAPS the box, it does not reload the modal** (client 2026-08-01: "it looks like a
   flicker… clicking the plus should render the add subject modal alone"). `FirstRunPanel` was unmounted the
   moment `addDialogOpen` flipped, and `NnModalShell` mounted a second, identical full-panel backdrop with the
   dialog's zoom/fade — the whole screen re-rendered for what should be a box swap. Now the panel stays
   mounted and only hides its box (`showBox`), and the dialog draws **only its box**: `showBackdrop` threads
   App → `SubjectTabStrip` → `SubjectTabAddDialog` → `SubjectTabNameModal` → `NnModalShell`.
   Second half of the fix, found by measuring rather than by eye: Radix always paints a `bg-black/80` overlay
   under `DialogContent`, which the opaque backdrop used to hide. Without a backdrop it dimmed the first-run
   panel — the probe pixel went 65 → 13 — so `DialogContent` gained `showOverlay` (`components/ui/dialog.tsx`)
   and the shell passes it alongside `showBackdrop`.
   Guarded by `tests/e2e/first-run-swap.spec.ts`: one backdrop and one box at all times, and a backdrop pixel
   sampled every frame through the click must not move in EITHER direction (lighter = it unmounted, darker =
   the dimming overlay landed) — measured 65 across all 12 frames. CANCEL swaps back the same way.

10. **Note body: the logo is blue and blurred, the background stays light** (client: "use the blurred logo
    for note background", their board labels it "NOTE LOGO BG" over a light body; then "NN blue blurred").
    Final state: `bg-note` with #464646 text as before, and the watermark is `ModalWatermark` in
    `fill=var(--color-accent)` at `opacity-[0.22]` with `blur-[0.390625rem]` — accent rather than the old
    white fill, and a touch more opacity than the modal box's 0.14, which is calibrated for a dark surface.
    **Two rounds were spent on a wrong reading first**, recorded so nobody repeats them: the ghost PNG
    (`GhostLogo`) was tried — accent blue at alpha 41/255, which on light grey reads as a blue haze — and
    then `NnModalBox`'s full dark treatment (dark base + inset accent glow + light text), which the client's
    board contradicts. `GhostLogo` is module-private again and the body text is #464646 again.
    **No deviation in the end.** The glow's alpha was tempered to 0.35 for one round, reasoning that the
    modal's `inset 0 23px 101px` at full accent is calibrated for a 189px box and floods a note body twice
    that size; the client rejected it — "it must be the blurred logo but with a blurred blue background… now
    it's a blurred NN with a gray background, it doesn't look in the design theme". The full-strength glow is
    exactly what makes the body read blue instead of grey, and it matches the crop they sent. Verbatim it is.
    A first pass used the ghost PNG (`GhostLogo`) instead; it is accent blue at alpha 41/255 and, without the
    dark background under it, read as a blue haze on light grey — which is what prompted the client's second
    message. `GhostLogo` is module-private again.

11. **Deleting the URL devoids every command that needs one** (client 2026-08-01: "deleting the URL makes
    devoid ALL commands only associated with having a URL populated"). Expanded row: ANCHOR was disabled
    only in read-only mode, so with no URL it still ran the whole pick flow — hid the panel, saved an
    anchor — and then bailed silently on click, because `handleAnchorClick` needs `toOpenableUrl(anchorUrl)`.
    It now greys on an empty URL: `disabled={draft.trim() === "" || (isReadOnly && !anchor)}` — the live
    draft, not the persisted value, so it greys as the field empties instead of on blur. Collapsed header:
    `CollapsedNoteNav` returns `null` on an empty URL — the client asked for **nothing there, not greyed
    buttons** (this narrows §3's "not gated on a typed label", which stands: the gate is the URL, never the
    label). Collapsed LINK keeps its own `!canOpenLink` guard, since the early return now only proves the URL
    is non-empty. COPY/PASTE/BIU are untouched — none need a URL, and PASTE is how a URL comes back.
    **The gate is emptiness, not openability, deliberately** (asked and decided 2026-08-01): the client's rule
    is about *deleting* the URL and nothing else. Accepted consequence — a half-typed URL (`asdf`) greys LINK,
    which has always used openability, while ANCHOR stays live and does nothing when clicked. Do not "fix"
    that divergence unasked; take it back to the client if it is ever reported.
    Both surfaces are pinned by `note-actions.spec.ts` (anchor-set case included).

## Where polish left off (last updated 2026-07-29)

Everything the client raised has been implemented and pixel-verified, and a full review pass has been
applied on top (§ sections 22–26). Suite at that point: **68 tests / 21 specs, all green** (now 75/24 after
the 2026-07-31 → 08-01 round). Threads that are closed but likely to come back:

- The plate's *inner* blue glow spreads ~8px horizontally vs ~5px vertically, because
  `preserveAspectRatio="none"` stretches the artwork 1.19× vertically and dilutes the glow there. The rim
  is unaffected. Flagged to the client, not yet answered.
- The scrollbar gutter is `0.5rem` (8px at the reference), so it *scales* with the panel rather than
  being a hard 8px. The client asked for "double the margin"; if they want a rigid 8px at every panel
  size, swap the rem for px in `.nn-scrollbar`.
- `+` glyph gaps are uneven on the cell's long axis — unavoidable in a non-square cell without an uneven
  white border, which the client rejected. The A–Z cell is taller than wide on a tall window and wider than
  tall on a short one (`--air-cell` = `100vh/26` against a 2.5rem column); that difference is systemic and
  accepted, so no glyph size can match Figma on both axes at once. **Updated 2026-07-30:** 71% is now a
  `max-height` *cap* on both axes rather than a width-only fit, so the tight axis binds and the glyph is
  never crushed — the failure mode on a short window. The client accepted the residual long-axis gap.
- **The visual baselines have now missed three deliberate changes** (note dates, the modal-backdrop logo
  artwork, and this `+` resize) because `maxDiffPixelRatio: 0.001` is larger than a small element's pixel
  delta. Treat them as a coarse net only; anything that matters gets an explicit geometry/artwork assertion,
  and regenerate them after every intended visual change or the committed reference silently stops
  depicting the app. **`test:e2e:update` is not enough to correct that** — `-u` defaults to `changed`, so a
  baseline whose delta is under the threshold is left untouched however many times it is rerun. The
  first-run `+` resize needed `npx playwright test visual.spec.ts --update-snapshots=all` to land.
- **Dead CSS: `.nn-metal-bar`** (`styles.css`, ~7 lines). The reskin moved the bar to Tailwind utilities in
  `BrandMetalHeaderBar` / `ModalMetalBar`; nothing carries the class any more (only the unrelated
  `data-nn-metal-bar` attribute, which tests use). Left in place because deleting CSS was outside the
  comment-cleanup and review-fix passes — safe to remove.
- **`ModalMetalBar` duplicates most of `BrandMetalHeaderBar`** (same wrapper, same inset shadow, same
  hilite div, near-identical flanking-band class) and exists mainly for the `left`/`right` slots and the
  `+1px` border-b offset. Collapsing it means adding those slots to `BrandMetalHeaderBar` and deleting
  `ModalMetalBar` + `HEADER_BAND_CLASS`. Not done: it touches the purchase modal's bar, and the plate
  numbers were already unified, which removed the part that could silently drift.
