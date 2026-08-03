# AGENTS.md — Notes For Net (NN) Chrome Extension

Governance + context for ALL agent work on this repo. **Read fully before touching any file.**
This file reflects current state as of 2026-07-04. Treat any documented behavior as unverified until
traced in code. Design snapshots (`docs/`, `css.txt`, `NN_DASHBOARD.png`) are NOT auto-updated —
check `docs/DESIGN_SOURCES_STATUS.md` for known divergences before relying on them.

---

## 1. Project overview

**Notes For Net (NN)** is a Manifest V3 Chrome extension: a notes panel anchored to the **right
edge** of the window, injected into every page (no popup, no side panel — the toolbar action sends
`TOGGLE_OVERLAY` to the active tab to slide it in/out). Pieces:

- **A–Z alphabetical index rail** ("AIR" in code) on the panel's left edge.
- Scrollable, rotated **subject tabs** as folders (alphabetically sorted).
- Stacked **note cards**: title, rich-text body (B/I/U), auto-filled URL + date,
  LINK/ANCHOR/COPY/PASTE, min/max/delete, drag-reorder with Cmd/Ctrl section separation. (A "price"
  field exists in the design but has NO code.)
- A **trial → purchase** flow (ExtensionPay + Stripe) behind the logo button, top-right.

**Spec & conventions:** the internal host element id `#nn-scroll-bookmarks-overlay-host` is
functional — CSS is scoped to it — despite the legacy name; keep it. The de-facto spec is the JSDoc
in `src/types/nnData.ts` plus `docs/*.txt` + `NN_DASHBOARD.png` + `css.txt` (the Figma export); trace
before trusting it. JSDoc ticket IDs (`NOTES-CORE-*`, `SUBJECT-TABS-*`, `AIR-2`, …) point at a
tracker that no longer exists — ignore them as live references. **Where the Figma export
(`NN_DASHBOARD.png` / `css.txt`) and `docs/*.txt` disagree, Figma wins** — e.g. the first-run empty
state uses Figma's two-line + accent "OR" layout ("Select a subject tab…" / OR / "Create a new
subject tab…"), NOT the single sentence in `docs/1_NN_DASHBOARD.txt`.

**Current design: the "metal" redesign (signed off 2026-07-08).** The overlay chrome follows
`docs/desired-look.txt` + `docs/desired-look-dashboard.png`, which SUPERSEDE `NN_DASHBOARD.png` /
`css.txt` for the header, A–Z rail, subject tabs, note drop-shadow, and the new footer. Full
implemented spec + exact tokens/files in `docs/DESIGN_SOURCES_STATUS.md`. The 6 e2e visual baselines
were **regenerated on sign-off (2026-07-08)** and are current — refresh again with
`npm run test:e2e:update` (calibration machine only) after any further intended design change.

## 2. Working rules (mandatory)

- **Agents modify files only and NEVER run git — the human owns all git.**
- **List every file touched at the end of each task. One concern per change. Never expand scope.**
- Payment/trial code is **OFF-LIMITS** (§7) — never edit, not even to "clean up".
- Read a file before editing it (several traps, §8).
- After any TS edit run `npm run typecheck` + `npm run lint` (husky pre-commit enforces both; keep
  them clean). An **e2e suite exists** (`npm run test:e2e`, §4, **81 tests / 27 specs**) — run it for
  overlay-behavior changes. It now covers subject-tab create/persist/scroll, A–Z letter highlight,
  LINK, anchor navigation, note-body image paste, brand-mark + header-text centering,
  note-action styling, and (2026-07-31 → 08-01) the metal bar's layer look, the blue-line stack under the
  nav bar, the purchase statement box + background squares, and the first-run box swap — all against
  stubbed pages. Still NOT covered —
  trial/paywall, full drag-reorder + multi-select (only the stuck-dim cleanup is), rich-text B/I/U,
  note COPY/PASTE, and LINK/ANCHOR on **real** sites — verify those in a loaded build.

## 3. File map

```
manifest.config.ts   MV3 manifest source (@crxjs/vite-plugin); permissions storage/scripting/unlimitedStorage, host <all_urls>
vite.config.ts       Vite + react + tailwind + crx; "@" → src.   package.json name "notes-for-net".  tsconfig strict ES2022
.env.example         VITE_EXTPAY_EXTENSION_ID + VITE_TRIAL_MODE (both documented)

src/background.ts    SW: ExtPay init/onPaid broadcast (§7); action click → TOGGLE_OVERLAY; owns per-tab session (chrome.storage.session, keyed tabId)
src/content.ts       Content-script ENTRY on <all_urls> (slim ~100 LOC): console suppressions, registerContentPanelHost, startup sequence (orphan-shell cleanup → open-hint PRE-MOUNT off-screen, never a visible paint → authoritative session restore → bfcache re-sync → anchor scroll). Logic split into src/content/
src/content/         Content-script modules (each owns its module-level state): overlayShell.ts (mount + show/hide/toggle/showOverlayWhenReady + uninstall teardown), overlayMetrics.ts (THE proportional sizing; uses lib/panelScaling), anchorScroll.ts (cross-nav scroll restore — retries until late/dynamic pages settle; session anchor key is URL-guarded so it can't fire on an unrelated page — + the open-gate promise), runtimeMessages.ts (TOGGLE_OVERLAY / PAYMENT_COMPLETED listeners, side-effect import), consoleSuppressions.ts, openHint.ts, constants.ts
src/messaging/       contentPanelProtocol.ts + contentPanelBridge.ts — in-realm panel↔content API (NOT postMessage, §8)
src/services/
  nnStorage.ts       Persistence read layer: ensureNNSyncInitialized / getNNSync (assembles the payload from shards) / subscribeNNSync. The rest of the family is imported DIRECTLY where used (no barrel re-export): pure helpers nnStorage{Defaults,Normalize,Builders} in src/lib/; side-effecting nnStorage{Shards,Migrations,SubjectTabs,Notes} in services/. Sharded chrome.storage.local (nnSyncMeta/nnNoteIndex/nnNote:<id>/nnLayout:<key>), migrations, CRUD
  storageService.ts  Typed wrapper. WARNING: "sync" namespace is remapped to local (§8) — nothing syncs
src/types/nnData.ts  Domain model + the most accurate JSDoc "spec"
src/hooks/           useNNDashboardSession (central state), useBrowserTabLocation (host URL poll), useOverlayPortalContainer (iframe portal), useSubjectTabStripScroll (subject-tab strip scroll persist/restore + reveal-on-create); useNoteSelection + useNoteDrag (NotesList multi-select + drag state machine, §3 NotesList); useNoteLinkAnchor (LINK/ANCHOR actions shared by the expanded URL row + collapsed note bar). `useSubjectTabCellSpans` is GONE (2026-07-31): tab length is pure CSS (`w-max aspect-square`) now that the client dropped A–Z-cell quantisation
src/lib/
  nnNoteLayout.ts    Note-list layout: section = group; resolveDropPlacement/applyDropPlacement (pure); NN_COLLAPSED_NOTE_HEADER_PX=40 (px trap §8)
  panelScaling.ts    Pure panel-width/root-font math (REFERENCE_PANEL_WIDTH_PX=686, clampPanelWidth, snapToDevicePx, rootFontPxForPanelWidth)
  notesListGeometry.ts / notesListConstants.ts  NotesList pure hit-test (resolveDragPreview, buildFlatEntries, snapshotRows) + drag constants
  nnStorage{Defaults,Normalize,Builders}.ts  nnStorage facade's pure pieces (defaults, payload migration, index/layout builders)
  tabSession.ts      Per-tab session type {open, activeSubjectTabId, notesScrollTop?, subjectTabScrollTop?} + GET/SET message helpers
  sanitizeNoteHtml.ts  Allowlist DOMParser sanitizer for note-body HTML
  airSubjectTabs.ts  A–Z helpers     nnDashboardNotes.ts URL match + visibility     pendingNavigation.ts cross-nav anchor/overlay keys (session anchor is URL-tagged; `pendingAnchorUrlMatches` gates it)
  subjectTabName.ts 25-char clamp (incl. spaces, client 2026-07-28)     openInNewTab.ts background-worker tab open with a window.open fallback     sessionUrlKey.ts / nnSyncKeys.ts / browsingContextWindow.ts / utils.ts (cn)
  extpay.ts          ExtPay singleton — OFF-LIMITS (§7)
src/overlay/         React UI inside the panel iframe
  App.tsx            Root composition + trial/billing gating (§7 lines OFF-LIMITS)
  DashboardHeader.tsx Single white-frame button strip (Add Note / nav Min·Max·Delete / Delete Tab / NN); trial button wiring (§7). Its bottom edge is the BLUE LINE stack: `div[data-nn-blue-line]` (4px accent + 3px white bar, in px) rendered AFTER the blurred dark `SHADOW __BLUE LINE` band so the band's blur cannot wash them; `sticky z-20`, deliberately UNDER the first-run backdrop
  DashboardContent.tsx Note-list container + copy/paste buffer + scroll-position persistence; the `select-or-create` empty state (tabs exist, none selected) via an `emptyState` prop from App.tsx. First run is NOT here since 2026-07-31 — it is `FirstRunPanel.tsx`, a full-panel `ModalBackdrop` layer (z-40, so it covers the nav strip and the strip's "+") carrying the "CREATE A SUBJECT TAB BY CLICKING [+]" box; its + is the shared `AddSubjectTabButton` opening App's add dialog
  DashboardFooter.tsx Blue metal footer bar — a deliberate COPY of the header band (same `BrandMetalHeaderBar`, same `NN_PLATE_CLASS`, same 5px rim) per the client 2026-07-28; the old `© 2026 NOTES FOR NET` line is gone. Always rendered as App's 3rd content-column child
  FirstRunPanel.tsx   First-run (zero tabs) full-panel NN backdrop (z-40, covering the header row, A–Z rail and strip — the client's render has no nav row there; the trial badge is therefore unreachable with zero tabs, a cost they accepted) + the CREATE A SUBJECT TAB box — the modals' treatment, not the grey dashboard (client 2026-07-31). Deliberately not a Radix dialog: nothing to dismiss, and a focus trap would fight the add-tab dialog its "+" opens
  AddSubjectTabButton.tsx Shared blue "+" create-tab button — at the top of the strip AND in the first-run panel, both opening the same Add dialog. The "+" is an inline SVG vector (symmetric 24×24 viewBox; height 0.58×--air-cell via styles.css; Windows shifts viewBox min-y −1 to cancel a 1px top-lean) — NOT the Fjalla font glyph css.txt describes
  TrashIcon.tsx      Note delete glyph — the client's Figma "TRASH ICON-01" (box + 4 bars) inlined; replaced the old Columns4 placeholder (2026-07-02)
  NotesList.tsx      Static-list dnd with multi-note selection: flat column, useDraggable, section groups, frozen-snapshot cursor hit-test. Selection (local state `selectedNoteIds`) = Cmd/Ctrl-click toggle + Shift-click range (anchor = last plain/Cmd click, inclusive; range via flattenLayoutNoteIds); a bare left-click rings nothing but sets a pending anchor (`plainAnchorPendingRef`) that the NEXT Cmd/Ctrl-click folds into the group (so "click A then Cmd-click B,C" = {A,B,C}); shown as a dark ring; cleared on drop, tab switch, outside-click, or when a selected note vanishes. Grabbing a selected note drags the whole set (dragOrderRef = ordered block, draggedSetRef = the same as a Set); the clone stacks up to 2 faint back-notes + a count badge. The list NEVER reflows during a drag — the dragged rows dim in place and a clone rides the cursor via DragOverlay (portaled to the iframe <body> so the frosted container's backdrop-filter doesn't offset its fixed positioning). Snapshot includes ALL visible rows (incl. the dimmed sources) in list-container px (rows scroll together → no scroll offset); the cursor hit-tests this for a visual slot, mapped back to a dragged-excluded `base` index, then applyDropPlacement inserts the whole block. Plain reorder shows one thin high-contrast line (#111 + white ring) hugging a row edge (last-of-A vs first-of-B via boundarySide). Cmd/Ctrl = NEW SECTION at the CURSOR slot (top / between / bottom — resolveDropPlacement asNewSection): a labeled "New section" line at the slot, or a dashed item-sized box past the last note (where there's room); Cmd + cursor at/below the last row's top snaps it to the very end (forgiving bottom drop zone). A plain single-note drop released over the note's OWN original row is a no-op (so a near-zero "select" drag can't merge a sole-item section into its neighbor); dragging onto another note applies normally. Commit on drop via applyDropPlacement. Split: `useNoteSelection` / `useNoteDrag` hooks (src/hooks/), `notesListGeometry` + `notesListConstants` (src/lib/, incl. the pure `resolveDragPreview` hit-test), `DraggableNoteRow` / `DropIndicator` / `DragClone` components.
  Note.tsx           Note card; header = drag handle only while title unfocused. Title edits on a CLEAN click (≤4px = PointerSensor distance), not on mousedown (preventDefault'd then focused in onClick) so click+drag moves instead of editing. Modifier-click (Cmd/Ctrl/Shift) selects via onSelect instead of editing — resolved in onClick so a modifier-drag doesn't also select (dnd-kit suppresses the click after a real drag); isSelected → selection ring.  NoteUrlEditor.tsx URL row + LINK/ANCHOR/COPY/PASTE (URL keeps significant trailing slashes so LINK opens the exact page; normalizes on blur, not per keystroke)
  RichTextBodyEditor.tsx contentEditable + execCommand B/I/U, sanitized; also paste images (screenshot files → data-URL `<img>`, or web-copied imgs — both sanitized to a safe src); body font = Inter; body bg = #D9D9D9 (`bg-note`) with the editor transparent so the dimmed `ModalWatermark` reads behind the text; that watermark is `NoteWatermark` (NOT `ModalWatermark`) — the background stays light; a dark modal-style body was tried and rejected against their board
  NoteWatermark.tsx  The note body's faint NN, and ONLY the note body's: the client's own `N.svg` + `N (1).svg` paths, glyphs of unequal width (160×100 + 170×100) with a 10-unit channel between them, `#E4E8E9` at `fillOpacity 0.5` = 6 levels of contrast on the #D9D9D9 body. It is meant to be barely a shade (client 2026-08-02); do not "fix" its contrast, and do not merge it back into `ModalWatermark` — that artwork is a different export (3.19:1 vs 3.40:1) and belongs to the modal boxes
  SubjectTabStrip.tsx Rotated strip + click-vs-dblclick; the "+" is the shared `AddSubjectTabButton`. Wheel-scroll = plain native scrolling, NO scroll-snap and no JS. The strip scrolls freely on touchpad AND mouse wheel; tabs are NOT magnetically snapped to whole positions. Why dropped: Chrome's CSS scroll-snap BLOCKS the mouse wheel (it fights each discrete notch → freezes after the first notch), and the web platform can't reliably tell a mouse from a trackpad, so snap can't be limited to the trackpad. After many attempts (JS scrollend settle → ~1s wait + 2-step; one-tab-per-notch → capped speed; custom rAF glide → fought trackpad momentum; `snap-proximity` → smooth on trackpad but froze the mouse wheel; device-detected snap-toggle in a `useTabStripScroll` hook → detection missed real mice) we dropped snapping entirely per the client's priority "smooth scrolling first, snapping second". Programmatic scrolls: `scrollToFirstLetter` (AIR cue) uses `scrollTo({behavior:"smooth"})` to a tab offset. The strip's own scroll is persisted per-tab and RESTORED on a cross-navigation reopen (`useSubjectTabStripScroll` hook, session field `subjectTabScrollTop`) so the selected tab stays where it was — NOT revealed to the fold (client 2026-07-06, replacing the old reveal-on-restore); `scrollTriggerFullyIntoView` (now in that hook) reveals the active tab only on a genuine selection change after mount, e.g. creating an off-screen tab. AlphabetIndexRollout.tsx A–Z rail: clicking a letter CUES it — scrolls the first tab starting with that letter to the TOP and does NOT select it (client AIR rule); the previously-selected tab stays selected with its notes visible (scrolled out of view). Blue letter = the last-TAPPED AI letter ONLY — a **one-way street**: selecting a subject tab never changes it, and nothing is highlighted until a letter is tapped (client 2026-07-04); matching letters hover-cue.
  BrandLockup.tsx    `BrandLogoFat` = the fat two-N mark (Figma "NN FAT LOGO", tight 46×17 viewBox) for the top-right header badge (red on trial / blue when paid). That badge CONTAINER is layout-frozen — px-2, no border (Figma's 3px white border is the row's white frame, as for all nav buttons) — and the svg width is pinned to 2.625rem so the footprint is pixel-identical at every panel scale (a wider one overflows the row at real widths); centering guarded by brand.spec. `BrandMetalHeaderBar` = the blue metal bar (Figma TOP METAL BAR DB) shared by the dashboard band, the footer and every small-modal header, with `NnLogoPlate` (120×29, black glyph stroke) centred between two flanking HEADER BOXes — metal must stay visible left and right of the plate, and the plate is FLUSH to the bar top and bottom (§8). Plate geometry lives here as the single source: `NN_PLATE_ASPECT` (3.1) + the matching literal `NN_PLATE_CLASS` (Tailwind cannot scan a template literal, so both exist and must agree), `PLATE_GLYPH_SQUEEZE_Y` (0.895, the vertical squeeze). The glyphs are deliberately NOT counter-scaled horizontally: the client renders this artwork in a 3.1:1 box too, so the NN keeps its 52.5% share of the plate width and takes the same non-uniform scale. Widening it to make the letter shapes geometrically true reads as bulky — the client rejected that 2026-07-29. The old gray `BrandHeaderBar`/`BrandLockup`/`BrandLogo` wordmark band was deleted 2026-07-28.
  NnModalShell.tsx   `NnModalShell` = the dialog spine every small modal sits in (Radix dialog + full-panel `ModalBackdrop`, no X — actions use CANCEL). `showBackdrop={false}` (add-tab dialog on first run) drops BOTH the backdrop and, via `DialogContent`'s `showOverlay`, Radix's own `bg-black/80` dimming layer, so the box swaps over the panel already on screen instead of the whole modal reloading + `ModalWatermark`, the dimmed faint NN behind a modal/note body: two N glyphs INLINED as paths (N_LEFT 189w + N_RIGHT 191.19w from the client's export). The app has NO SVG-import pipeline — nothing imports `.svg`, every icon/logo is inline, because bundled asset URLs break in the host-origin iframe (same reason fonts use `chrome.runtime.getURL`) — so a glyph change is edited here, not by swapping a file. Renamed from `NnModalFrame.tsx` 2026-07-28 when the pre-redesign `NnModalFrame` box and its Cancel/OK buttons were deleted.
  NnModalBox.tsx     Figma MODAL BG (467×189, height overridable) — accent frame + inset glow + watermark + `ModalMetalHeaderBar`; carries `data-nn-modal-box`
  ModalBackdrop.tsx  Full-panel opaque modal background (Figma BUY MODAL ALL): dark base, blurred square grid (its centring WRAPPER is load-bearing — `absolute left-1/2` alone shrink-to-fits the grid to half the panel and the columns smear together), optional `statement` slot (purchase only; when present the ghost/wordmark/tagline switch to a second, decoupled layout), ghost NN (`src/assets/ghostNnPng.ts` — the client's PNG base64'd, since its blur/compositing were baked in and the SVG export dropped them), brand headline, optional tagline. `ModalMetalBar` = its top bar; its `plate` slot defaults to the purchase artwork (`ModalLogoBox`, 121×31, `#0081B8` stroke that reads as NO outline) and `NnModalShell` passes the dashboard plate instead — that bar stands where the brand band was, so the logo design must not change when a modal opens. **TWO plate designs is deliberate** (client-confirmed): purchase has its own, everything else shares one, and only the SIZE matches
  CollapsedNoteNav.tsx Collapsed-bar LINK/ANCHOR, same handlers as the expanded URL row via `useNoteLinkAnchor`
  SubjectTab*Dialog.tsx / NoteDeleteConfirmDialog.tsx dialogs (deletes use CANCEL/OK)     PaywallDialog.tsx full-panel purchase modal on `ModalBackdrop` — its `ModalMetalBar` carries the trial box + logo plate + BUY $5; wiring OFF-LIMITS (§7)
  styles.css         Tailwind 4 @theme + iframe-injected styles (?inline import). `--font-statement` (Familjen Grotesk, purchase statement); `.nn-cap-trim` / `.nn-label-center` centre a WORD rather than its line box (`text-box: trim-both cap alphabetic`; the trim reaches an `<input>`, but NOT a flex container's anonymous item — hence the block/`align-content` half); `[data-note-body]` colour is light since the body took the modal treatment. Host-wide `#host *` Fjalla default + an ID-scoped `.font-ui` re-assert so Inter surfaces (note URL/date row) survive it (§8). `--air-cell` is declared on the iframe ROOT, not `#host`, or portaled dialogs lose it. `[data-air-cell]` + `[data-slot=tabs-trigger]` metallic gradients (dark-top→light-bottom), `--shadow-air` (A–Z column drop shadow), `--shadow-air-cell` (per-cell bevel), `.nn-scrollbar` (blue thumb, 8px gutter, pill ends). **`.nn-metal-bar` is DEAD** — the 2026-07-28 reskin moved the bar to Tailwind utilities in `BrandMetalHeaderBar`/`ModalMetalBar`, and nothing carries that class any more; the rule only survives because deleting CSS was out of scope for the review pass
src/components/ui/   shadcn primitives, re-themed to h-10 / text-2xl scale (§6). `dialog.tsx` gained `showOverlay` — Radix always paints a `bg-black/80` layer under `DialogContent`, which dims anything already on screen when the dialog itself draws no backdrop
dist/                Built output (loadable). Built from the configured `.env` (real ExtPay id + prod 7-day trial) → paywall active (§7)
dist-e2e/            E2E build (`npm run build:e2e` — ExtPay compiled OUT); what the test suite loads. Gitignored
tests/e2e/           Playwright suite (**81 tests / 27 specs**): functional, visual, navigation, anchor, anchor-persist, http-context, link, reorder, air, image-paste, brand, note-actions, metal-bar, **metal-bar-layers** (the bar's LAYER look in painted pixels — the client's crop is the source of truth there, not their Figma CSS), modal-backdrop, panel-shadow, paywall, **paywall-statement**, scrollbar, subject-tab-sizing, nav-strip-frame, **blue-line**, **first-run-swap**, **note-title-clipping** (the note title input must not be cropped by a text-box trim — inputs clip their inner editor), **modal-label-centre** (every modal box centres its label INK, measured against the box's arithmetic inner edges — a clip taken at those edges rounds onto a half device row and inverts the reading), session-persistence, add-tab-glyph; baselines in __screenshots__/ ARE committed — calibrated to one machine, expect small font-render drift elsewhere). Two known limits of the visual baselines: `page.clock` never reaches the overlay iframe, so any snapshot with a note bakes in the day it was generated; and `maxDiffPixelRatio: 0.001` absorbs small-area changes — a logo-artwork swap in the top bar passed unnoticed, so geometry/artwork invariants get their own explicit assertions instead. Fixtures boot headed Chromium per test with the extension loaded — see tests/e2e/README.md
playwright.config.ts Playwright config (1 worker, screenshot settings, snapshot path template)
```

## 4. Stack & how to run

Vite 5.4 + @crxjs/vite-plugin 2.5 + React 18.3 (**@types/react is 19.x — known mismatch**),
TypeScript 6.0.3 (`ignoreDeprecations: "6.0"`), Tailwind 4.3 (CSS-first; theme in `styles.css @theme`,
no `tailwind.config`), radix 1.5, @dnd-kit, extpay 3.1. (react-query was removed — it was a mounted
provider with no queries; don't re-add it without an actual use.)

Build & load:
1. `npm install`
2. `.env` (build-time — rebuild after changes): `VITE_EXTPAY_EXTENSION_ID=<id>` (empty/missing
   compiles the paywall OUT) and `VITE_TRIAL_MODE=prod` (anything else = 7-minute dev trial, not 7 days).
3. `npm run build` → `dist/`
4. chrome://extensions → Developer mode → Load unpacked → pick the **`dist/`** folder; reload open tabs.
5. Click the toolbar icon on an http/https page to toggle (silently no-ops on chrome://, Web Store, etc.).

**Iterating:** `npm run dev` (CRXJS) is the live workflow — load `dist/` unpacked once and edits
hot-reload the extension + open tabs. `npm run build` is the static/production build (and correctness
gate). **Cross-machine testing (e.g. Windows): `npm run pack`** = build + zip `dist/` →
`nn-extension-<version>.zip` (gitignored; 1.0.3 today). The dev `dist/` is wired to the localhost dev server and will
NOT run off-machine — always `pack` (a production build) for another machine, then refresh the test tab.

Gates: `npm run typecheck`, `npm run lint` (husky pre-commit runs both). E2E: `npm run test:e2e`
(Playwright, **headed-only** — re-verified 2026-07-29 on PW 1.61.1: headless never starts the extension's
service worker, so every spec times out. The window is parked at `--window-position=-2400,-2400` so runs
no longer cover the desktop; rendering and screenshots are unaffected. The fixture also un-sets
Playwright's default `--disable-back-forward-cache`, because NN's restore path differs between a bfcache
Back — which never re-runs the content script — and a rebuilt page; note a bfcache restore fires no
`load` event, so `goBack`/`waitForURL` must use `waitUntil: "commit"`. **`npm run test:e2e:live`** runs
`*.live.spec.ts` against the real ford.com/tesla.com — needs network, excluded from the default suite by
`testIgnore` — because stub pages are always bfcache-eligible while real sites usually are NOT, which is
the opposite restore path. Refresh visual baselines
deliberately with `npm run test:e2e:update`, reviewing each PNG). Details + covered/uncovered scope:
`tests/e2e/README.md`. Packaging for another machine: `npm run pack` → `nn-extension-<version>.zip`
(production build, paywall ACTIVE — a fresh install starts the trial, so the header badge is RED and the
blue paid-logo path is unreachable).

## 5. Architecture in one paragraph

`background.ts` (SW) relays toolbar clicks as `TOGGLE_OVERLAY` and owns the per-tab session in
`chrome.storage.session` (keyed by `tabId`, cleared on `tabs.onRemoved`). `content.ts` (on
`<all_urls>`) appends a fixed, right-anchored shell `<div>` (z-index 2147483647) holding an
about:blank `<iframe>`, doc.writes a blank doc, and renders React `App` into it via
`overlay/mountOverlayApp.tsx` (which injects the self-hosted `@font-face` set + the whole Tailwind
stylesheet as inline `<style>`s, so `dist/` has no .css asset — expected; the fonts are separate
web-accessible `.ttf` assets referenced via `chrome.runtime.getURL`). Mounting is **eager and synchronous, from the
content-script realm**, so panel and content script share one JS context (messaging/ is in-memory
function calls, not postMessage). **Do not lazy-load the app via a content-script `import()`:** it
was tried and reverted — the runtime `import()` failed on some strict-CSP sites (e.g. tesla.com),
leaving a visible but empty, click-blocking shell. Eager mount keeps NN reliable on `<all_urls>`
at the cost of the ~400 kB content chunk on every page. All persistence is `chrome.storage.local`
via `nnStorage.ts`. Panel height tracks `visualViewport`; width is viewport-proportional with a
root-font knob (§6).

**Min/max across navigation (client-driven, 2026-07-31).** The tab session is the ONLY authority for
whether NN is on screen. The per-origin `sessionStorage` open-hint (`content/openHint.ts`) merely
**pre-mounts** the panel parked off-screen (`premountOverlay`) so the authoritative async read has a
painted panel to slide in; it must never paint the panel itself — it goes stale as soon as NN is toggled
on another origin, and painting from it flashed a minimized panel back on. A **bfcache** Back never
re-runs the content script, so a `pageshow`/`event.persisted` listener re-applies the session (~1 frame,
the browser repaints the frozen DOM first) and fires `TAB_RESTORED_EVENT` so the panel re-reads storage.
The cross-origin reveal is a 300ms **slide** once the panel has painted (two rAFs, capped by
`PANEL_REVEAL_CAP_MS`); the old frosted veil is gone. Keeping the panel alive across a navigation is
impossible — Chrome destroys the document, the content script and the iframe.

## 6. Responsive sizing — core shipped, gaps remain

**Calibration reference: 16" laptop, 1920×1080, Windows 11 @ 100% scaling.**

Core sizing is done: `src/content/overlayMetrics.ts` (math in `src/lib/panelScaling.ts`) sets a
viewport-proportional panel width (`viewportWidth × REFERENCE_PANEL_WIDTH_PX / REFERENCE_VIEWPORT_PX`,
clamped) and an iframe root-font knob (`rootFontPx = panelWidth/686 × 16`) on every `visualViewport`
resize, so rem lengths scale with the panel; an `--air-cell: calc(100vh/26)` grid drives the A–Z rail, the "+", subject
the two header bars (1 cell each); subject tabs are sized by their own label, NOT the cell grid. The old "no width logic / constant ~758px"
defect is gone.

Still open (minor):
1. **Legacy stored `gapBeforePxByNoteId`** — no longer written (sections are layout groups now, §8),
   but old stored values may exist; account for them on migrate.

Fonts are **self-hosted** (Fjalla One + Inter 400/600/700 + italic + Familjen Grotesk 400 for the purchase
modal's statement box, `--font-statement`; all SIL OFL 1.1): bundled as web-accessible
`.ttf` assets and injected as `@font-face` by `mountOverlayApp` via `chrome.runtime.getURL` (absolute
`chrome-extension://` URLs — the iframe is host-origin, so a bundler-relative path would resolve
against the page). The Google Fonts CDN `@import` was removed (it was blocked on strict-CSP pages and
dead offline). Caveat (do not re-flag): a host CSP whose `font-src` excludes the `chrome-extension:`
scheme still forces a system-font fallback; the only complete fix is an extension-origin iframe (not done).

Fix surface (keep payment lines out of any diff): `src/content/` (overlayMetrics + lib/panelScaling), `styles.css`,
`components/ui/{button,input,tabs}.tsx`, `SubjectTabStrip.tsx`, `nnNoteLayout.ts` + `NotesList.tsx`,
`RichTextBodyEditor.tsx`, `DashboardHeader.tsx`, `App.tsx` (presentation lines only — §7),
`AlphabetIndexRollout.tsx`, `NoteUrlEditor.tsx`, dialog offsets.

## 7. OFF-LIMITS: payment / trial / purchase code

Do **not** modify any of the following, for any reason, in any task (line ranges approximate):

| Location | What it is |
|---|---|
| [src/lib/extpay.ts](src/lib/extpay.ts) (whole file) | ExtPay client singleton + `isExtPayConfigured` |
| [src/overlay/App.tsx](src/overlay/App.tsx) ~22–206 | Trial constants, clock, `refreshBillingAccess`, `isReadOnly` gating, payment-completed listener |
| `isReadOnly` checks through `App.tsx` render | Business gating of every mutation |
| [src/overlay/PaywallDialog.tsx](src/overlay/PaywallDialog.tsx) | Full-width trial bar: BUY → `onBuy`, LOG IN (restore) → `onLogin`. The `onBuy`/`onLogin`/`onOpenChange`/trial props are the protected wiring; layout-only edits were done with explicit human OK and still need it. Done under that rule (2026-07-31 → 08-01): the `div[data-paywall-dismiss]` wrapper (any click but BUY closes) and the STATEMENT box — layout/copy only. |
| [src/overlay/DashboardHeader.tsx](src/overlay/DashboardHeader.tsx) ~21–46, ~124–129 | Trial logo-button wiring |
| [src/background.ts](src/background.ts) ~14–29 | ExtPay `startBackground` + `onPaid` → `PAYMENT_COMPLETED` broadcast |
| [src/content/runtimeMessages.ts](src/content/runtimeMessages.ts) ~34–35 | `PAYMENT_COMPLETED` → `nn-payment-completed` event |
| [manifest.config.ts](manifest.config.ts) ~28–39 | ExtPay content script on extensionpay.com |
| `.env` / `VITE_EXTPAY_EXTENSION_ID` / `VITE_TRIAL_MODE` | Build-time payment config |

**Proximity hazard:** `App.tsx` and `DashboardHeader.tsx` are core layout files AND carry trial
wiring. Layout work there is allowed only on clearly-presentation lines, payment lines untouched and
unmoved. When in doubt, stop and flag for the human.

**Payment state (current):** `.env` is configured — a real `VITE_EXTPAY_EXTENSION_ID` +
`VITE_TRIAL_MODE=prod` — so a build enables the paywall and the real 7-day trial, and
`getUser().paid` / `openPaymentPage()` hit the live ExtPay extension. Paid status is server-side at
ExtPay (not stored in the extension), keyed to the Stripe-checkout email.

**Restore-after-reinstall:** premium auto-restores via Chrome sync (ExtPay's user key rides
`chrome.storage.sync`), or manually via the trial bar's **LOG IN** button → `openLoginPage()` (App
`onLogin` → PaywallDialog) which opens ExtPay's hosted login; signing in with the Stripe email
re-grants paid status. (`EXTPAY_EXTENSION_URL` is still an exported-but-unused constant.) The local
trial (`nn_trial_started_at` in `chrome.storage.local`) deliberately resets on uninstall/reinstall.

## 8. Known traps (still live)

- **Never decide overlay visibility from the open-hint** (`content/openHint.ts`). `sessionStorage` is
  per-origin: minimize on site B and site A's hint still reads "open", so painting from it flashes a
  panel the user dismissed. It may only `premountOverlay()`. And do NOT gate that on
  `performance.getEntriesByType("navigation")[0].type === "back_forward"` — that entry is still **empty**
  when the content script runs, so the guard silently no-ops (it appeared to work on one site by timing
  luck; measured on tesla.com, 2026-07-31). §5 has the whole restore model.
- **A build is not your source.** After reverting/restoring a file, re-run `npm run build:e2e` before
  re-running any spec — two "the fix doesn't work" investigations this sprint were stale bundles. And
  never grep the bundle for an identifier to check a fix shipped: it is minified and renamed. Grep an
  emitted CSS rule / string literal, or compare timestamps.
- **IN-PROGRESS REDESIGN (2026-07-28).** A section-by-section modal + dashboard reskin is uncommitted
  in the working tree. **Read [docs/REDESIGN_2026-07-28_STATUS.md](docs/REDESIGN_2026-07-28_STATUS.md)
  before touching modals, the brand band, the subject-tab strip, the `+` button or `styles.css`** — it
  lists what shipped, the shared modal spine (`NnModalShell` / `NnModalBox` / `ModalBackdrop`), open
  questions, dead code awaiting deletion, and the traps below that came out of it.
  **Before starting ANY new design section, read its "How to run the next redesign" section** — that
  sprint burned ~10 review rounds on one element. The short version: intake the whole section at once
  (1:1 render + every layer's CSS + *which element the sizes are anchored to*); render 2–3 variants and
  let the client pick from images instead of negotiating a number in words; when the client's render
  disagrees with their Figma CSS the render wins (copy-as-CSS drops blend modes, layer order and stroke
  gradients — ask for a flattened PNG early); batch the review into one artifact set per section; and
  never answer a visual complaint with "the tests pass" — if the user sees a defect and the suite is
  green, the test's reference frame is wrong, so fix the test first.
- **Never size anything HORIZONTAL from `--air-cell`.** It is `calc(100vh / 26)` — viewport *height*.
  Horizontal dimensions ride the panel-width root-font knob (`w-10` = 2.5rem). Coupling the two
  overflowed the panel and only looked right at one window aspect. A–Z cells are therefore not square
  except coincidentally.
- **Rotated subject tabs** (`rotate-90 origin-top-left translate-x-[2.5rem]`): layout stacks them by
  their UNROTATED height while the visible on-strip length is the WIDTH — keep the two equal (hence
  `w-max aspect-square`). Length is the label + `px-[1ch]` each end and is deliberately NOT quantised to
  A–Z cells (client 2026-07-31: "do not try to line it up with alpha index boxes"), so tab edges do not
  meet the A–Z rows. `TabsTrigger`'s invisible `after:` indicator at `-right-1` inflates `scrollWidth` by
  ~3px, so never use `scrollWidth > clientWidth` as a text-clipping check — measure the label with canvas.
- **"sync" does not mean sync.** `storageService.getAreaName` remaps the `"sync"` namespace to
  `chrome.storage.local` ([storageService.ts:46-47](src/services/storageService.ts#L46-L47)). All
  `NNSync*` types operate on LOCAL storage; nothing syncs across devices.
- **Mint ids with `generateId()` ([src/lib/generateId.ts](src/lib/generateId.ts)), never
  `crypto.randomUUID()` directly.** `randomUUID` is secure-context-only → `undefined` on plain-`http://`
  pages (where the overlay also runs), so it threw and tab/note creation silently failed (dialog never
  closed). `generateId` prefers `randomUUID`, falls back to a `getRandomValues`-built v4 (not gated).
  Guarded by the `http-context` e2e spec. Fixed 2026-07-08.
- **B/I/U via deprecated `document.execCommand`**, body persisted as `innerHTML`. It now passes
  through `sanitizeNoteHtml.ts` on render/emit/paste (the prior stored-XSS hole is closed) — keep
  that sanitizer in the path for any body-HTML change. The sanitizer also allows `<img>` with a
  **scheme-validated `src`** (data:image raster or http(s); svg/`javascript:` dropped), so pasted
  images persist; `RichTextBodyEditor`'s paste handler reads image files → data-URL `<img>`.
  Body font is Inter (Fjalla One has no real bold).
  The prop→DOM `value` sync is **focus-gated** (adopts external `value` only while unfocused) so the
  async-persist round-trip can't reset `innerHTML` / jump the caret mid-type.
- **The messaging "protocol" is in-memory** (shared realm; function calls, not postMessage).
  background↔content runtime messages are ad-hoc typed per file.
- **Sections are layout groups; `gapBeforePxByNoteId` is legacy-only** — deserialized and migrated by
  `splitGroupsAtSeparationGaps`, never written. Old stored pixel gaps may still exist (migration).
- **Several URL-normalizer flavors with subtle differences** — `trimTrailingSlash` now lives only in
  `pendingNavigation.ts` (anchor keys); URL *matching* trims trailing slashes inline
  (`nnDashboardNotes.comparableUrlKey`, `sessionUrlKey`); **NoteUrlEditor PRESERVES significant
  trailing slashes** (drops only the bare root `/`) so LINK opens the exact page, and normalizes on
  blur/commit — not per keystroke. Reuse the right flavor, don't add another.
- **Host-scoped CSS misses portaled dialogs — in BOTH directions.** Dialogs portal via `useOverlayPortalContainer`, which in practice resolves to the iframe `<body>` — OUTSIDE `#nn-scroll-bookmarks-overlay-host`. So a rule scoped `#nn-scroll-bookmarks-overlay-host [data-x]` does NOT reach dialog content; global utility classes (and the iframe-body default font) still do. This is why the subject-tab name inputs (Add + Rename) use a plain `input[data-subject-name-input]` font-size rule (not host-scoped). The reverse also bites: host-wide defaults (`#host * { font-family: Fjalla }`) don't reach portaled dialogs — that produced the two-renderings brand-badge bug (header Fjalla vs modal Inter; client-reported, fixed 2026-07-02 by re-asserting `.font-ui` ID-scoped in styles.css, pinned by an e2e regression test). Any utility that must beat the host-wide default needs that same ID-scoped re-assert; any host-wide default must be checked against portaled content.
- **Create-on-plain-http silent failure — FIXED (found & fixed 2026-07-02).** Ids were minted with `crypto.randomUUID` (secure-context-only → `undefined` on `http://`), so the create dialog threw and stayed open on plain-http pages. All call sites now mint via `generateId()` ([src/lib/generateId.ts](src/lib/generateId.ts)) — `randomUUID` with a `getRandomValues`-built v4 fallback; covered by the `http-context` e2e spec (see the id-minting rule above).
- **Rotated subject tabs report a bogus bounding box.** The rotate-90 + translate combo (Tailwind v4 individual transform props) PAINTS correctly, but `getBoundingClientRect` is a ~104px square overlapping the A–Z rail — breaking rect-based tooling (Playwright rect-center clicks hit an A–Z letter; any future scrollIntoView/hit math would too). The e2e helpers `clickSubjectTab`/`dblclickSubjectTab` encode the workaround (real mouse click at strip-column x + tab-box y).
- **`text-box` trim does not reach a flex container's text.** `text-box: trim-both cap alphabetic` is how a
  label gets its GLYPHS centred instead of its line box (Fjalla's ascent/descent are asymmetric, so a
  flex-centred label paints ~1.5px high). It applies to the element that owns the text, so a flex container
  is a no-op — its text sits in an anonymous item that inherits no trim. Hence `.nn-label-center` also
  switches the element to `display:block` + `align-content:center`.
  **NEVER on an `<input>` (learned 2026-08-02, client-reported).** It does reach the inner editor, but that
  editor is clipped (`overflow: clip`), so the trim crops the text to the cap band: cap tops shaved and every
  descender gone. The note title shipped that way for a day. Padding does not restore it, and the clip is at
  the trimmed box rather than the input's own box, so any gap check against the input's border box passes
  while the defect is plainly visible. `note-title-clipping.spec.ts` pins it in painted ink (ink height in em
  + descender rows below the baseline; a top-edge "abruptness" test is NOT usable — antialiasing at the cap
  top depends on where it lands on the device grid). Chrome centres a single-line input's editor from font
  metrics, so line-height and padding cannot tune it in sub-pixel steps: without the trim the cap band sits
  0–1 CSS px high depending on panel width, and that is accepted.
- **`bottom` on an absolutely-positioned child is measured from the parent's PADDING box.** The header's blue
  line sat 2px high and painted over its own 2px white `border-b` until both offsets became `calc(9px + …)`.
- **A negative z-index child still paints ABOVE its parent's background and box-shadows.** `-z-10` will not
  push the blue-line shadow band behind a `<header>` box-shadow; only DOM order or geometry can.
- **An `absolute left-1/2` box with no width shrink-to-fits against HALF the container.** The purchase
  modal's 3×5 square grid was squeezed from 82% of the panel to 49.6% and its columns overlapped into one
  vertical smear ("looks nothing like the design"). Wrap such a box in an `inset-0` flex centring container.
- **Radix `DialogContent` always paints a `bg-black/80` overlay under itself.** Invisible while the dialog
  draws an opaque backdrop; the moment it doesn't, it dims whatever is already on screen. `showOverlay`
  (`components/ui/dialog.tsx`) turns it off.
- **A `sticky` element with a z-index is its own stacking context.** No z-index on a descendant can beat a
  sibling of that element — which is why the trial badge inside the header cannot be raised above the
  first-run backdrop on its own.
- **Runtime style sweeps must use the same UNIT as the class.** A sweep that set `bottom` in absolute px
  while the class used rem measured a geometry that never ships: rem here is panel-scaled (root ≈ 11.7px at
  the test panel, not 16). Set the same unit, or read the computed value back.
- **Silent failures:** many empty `catch {}` blocks and no logging anywhere. Don't imitate in new code.
- **Reported "faded note stuck in reorder dim" — NOT reproduced (2026-07-04).** The dim (`opacity-40`
  in `DraggableNoteRow`) is gated on `activeId` (an active drag) and clears on drag end/cancel; dnd-kit
  self-heals a release outside the iframe via pointer capture (`reorder.spec` covers that). The
  persistent-dim state the client saw couldn't be reproduced; root unconfirmed — get client repro
  before attempting a fix (a defensive "clear drag state if no pointer is down" watchdog is the fallback).

Already handled — do not re-flag or re-add: the stored-XSS sanitizer is in place; the `tabs`/`activeTab`
permissions, the dead `nnSessionsByUrl` per-URL session layer, and the `OPEN_SCROLL_BOOKMARK` /
`types/bookmark.ts` starter code were removed; react-query was removed (don't re-add it without an
actual query). (`EXTPAY_EXTENSION_URL` is an exported-but-unused constant in §7's extpay.ts.)

## 9. Conventions

- TS strict; `unknown`-first parsing of storage payloads; almost no casts.
- Prettier (80 cols, double quotes, semicolons) + ESLint 9 flat config + husky pre-commit.
- Naming: `nn`/`NN` for product code; "AIR" = Alphabetical Index Rollout (the A–Z rail).
- React function components, forwardRef where needed, props drilled (no context); shadcn primitives in
  `components/ui/`. Path alias `@/` → `src/`. Tailwind 4 utilities + `@theme` tokens in `styles.css`;
  one-off CSS only for host-page-level concerns.
- Comments: **max one line each** (no multi-line blocks); describe what/why only and **delete
  self-explanatory ones** (anything that merely restates the code); never narrate the change you just
  made; sparse.
- **File size — hard cap 300 LOC.** At ~250 LOC (the approach zone) a file is already due to split;
  do it *before* adding more, not "later": constants → a sibling `*Constants.ts` (or `src/lib/`),
  pure helpers → `src/lib/`, React hooks → `src/hooks/`, sub-components → their own files in the
  owning folder, content-script modules → `src/content/`. Splitting an over-cap file is triggered
  by the NEXT change that adds to it — don't preemptively refactor a file that's merely over the
  line and otherwise untouched; but when you go to add behavior to one, split first instead of
  merging. Detection is mechanical: ESLint `max-lines` warns at 300 (run `npm run lint`), so any
  file in the 300 zone surfaces every lint. Known over-cap files left as-is (split only when next
  adding to them): `NoteUrlEditor.tsx` (495), `contentPanelBridge.ts` (420), `App.tsx` (377, trial
  logic), `useNoteDrag.ts` (310), `DashboardContent.tsx` (308). Files within ~±10 LOC of the cap
  are fine — leave them untouched (user rule, 2026-07-02).
- **No barrel / re-export facades.** Import each helper directly from the module that defines it;
  never re-export others' symbols (`export … from "…"`) just to keep a stable import surface. When
  you split a file, repoint its consumers to the new modules (don't leave the old file re-exporting).
