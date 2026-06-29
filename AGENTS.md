# AGENTS.md — Notes For Net (NN) Chrome Extension

Governance + context for ALL agent work on this repo. **Read fully before touching any file.**
This file reflects current state as of 2026-06-29. Treat any documented behavior as unverified until
traced in code.

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

## 2. Working rules (mandatory)

- **Agents modify files only and NEVER run git — the human owns all git.**
- **List every file touched at the end of each task. One concern per change. Never expand scope.**
- Payment/trial code is **OFF-LIMITS** (§7) — never edit, not even to "clean up".
- Read a file before editing it (several traps, §8).
- After any TS edit run `npm run typecheck` + `npm run lint` (husky pre-commit enforces both; keep
  them clean). **Zero tests exist** — every behavioral change must be verified in a loaded build.

## 3. File map

```
manifest.config.ts   MV3 manifest source (@crxjs/vite-plugin); permissions storage/scripting/unlimitedStorage, host <all_urls>
vite.config.ts       Vite + react + tailwind + crx; "@" → src.   package.json name "notes-for-net".  tsconfig strict ES2022
.env.example         VITE_EXTPAY_EXTENSION_ID + VITE_TRIAL_MODE (both documented)

src/background.ts    SW: ExtPay init/onPaid broadcast (§7); action click → TOGGLE_OVERLAY; owns per-tab session (chrome.storage.session, keyed tabId)
src/content.ts       Content-script ENTRY on <all_urls> (slim ~70 LOC): console suppressions, registerContentPanelHost, startup sequence (orphan-shell cleanup → open-hint paint → restore → anchor scroll). Logic split into src/content/
src/content/         Content-script modules (each owns its module-level state): overlayShell.ts (mount + show/hide/toggle/showOverlayWhenReady + uninstall teardown), overlayMetrics.ts (THE proportional sizing; uses lib/panelScaling), anchorScroll.ts (cross-nav scroll restore + the open-gate promise), loadingVeil.ts (cross-origin cold-restore veil), runtimeMessages.ts (TOGGLE_OVERLAY / PAYMENT_COMPLETED listeners, side-effect import), consoleSuppressions.ts, openHint.ts, constants.ts
src/messaging/       contentPanelProtocol.ts + contentPanelBridge.ts — in-realm panel↔content API (NOT postMessage, §8)
src/services/
  nnStorage.ts       Persistence read layer: ensureNNSyncInitialized / getNNSync (assembles the payload from shards) / subscribeNNSync. The rest of the family is imported DIRECTLY where used (no barrel re-export): pure helpers nnStorage{Defaults,Normalize,Builders} in src/lib/; side-effecting nnStorage{Shards,Migrations,SubjectTabs,Notes} in services/. Sharded chrome.storage.local (nnSyncMeta/nnNoteIndex/nnNote:<id>/nnLayout:<key>), migrations, CRUD
  storageService.ts  Typed wrapper. WARNING: "sync" namespace is remapped to local (§8) — nothing syncs
src/types/nnData.ts  Domain model + the most accurate JSDoc "spec"
src/hooks/           useNNDashboardSession (central state), useBrowserTabLocation (host URL poll), useOverlayPortalContainer (iframe portal); useNoteSelection + useNoteDrag (NotesList multi-select + drag state machine, §3 NotesList)
src/lib/
  nnNoteLayout.ts    Note-list layout: section = group; resolveDropPlacement/applyDropPlacement (pure); NN_COLLAPSED_NOTE_HEADER_PX=40 (px trap §8)
  panelScaling.ts    Pure panel-width/root-font math (REFERENCE_PANEL_WIDTH_PX=686, clampPanelWidth, snapToDevicePx, rootFontPxForPanelWidth)
  notesListGeometry.ts / notesListConstants.ts  NotesList pure hit-test (resolveDragPreview, buildFlatEntries, snapshotRows) + drag constants
  nnStorage{Defaults,Normalize,Builders}.ts  nnStorage facade's pure pieces (defaults, payload migration, index/layout builders)
  tabSession.ts      Per-tab session type {open, activeSubjectTabId, notesScrollTop?} + GET/SET message helpers
  sanitizeNoteHtml.ts  Allowlist DOMParser sanitizer for note-body HTML
  airSubjectTabs.ts  A–Z helpers     nnDashboardNotes.ts URL match + visibility     pendingNavigation.ts cross-nav anchor/overlay keys
  subjectTabName.ts 8-char clamp     sessionUrlKey.ts / nnSyncKeys.ts / browsingContextWindow.ts / utils.ts (cn)
  extpay.ts          ExtPay singleton — OFF-LIMITS (§7)
src/overlay/         React UI inside the panel iframe
  App.tsx            Root composition + trial/billing gating (§7 lines OFF-LIMITS)
  DashboardHeader.tsx Single white-frame button strip (Add Note / nav Min·Max·Delete / Delete Tab / NN); trial button wiring (§7)
  DashboardContent.tsx Note-list container + copy/paste buffer + scroll-position persistence
  NotesList.tsx      Static-list dnd with multi-note selection: flat column, useDraggable, section groups, frozen-snapshot cursor hit-test. Selection (local state `selectedNoteIds`) = Cmd/Ctrl-click toggle + Shift-click range (anchor = last plain/Cmd click, inclusive; range via flattenLayoutNoteIds); a bare left-click rings nothing but sets a pending anchor (`plainAnchorPendingRef`) that the NEXT Cmd/Ctrl-click folds into the group (so "click A then Cmd-click B,C" = {A,B,C}); shown as a dark ring; cleared on drop, tab switch, outside-click, or when a selected note vanishes. Grabbing a selected note drags the whole set (dragOrderRef = ordered block, draggedSetRef = the same as a Set); the clone stacks up to 2 faint back-notes + a count badge. The list NEVER reflows during a drag — the dragged rows dim in place and a clone rides the cursor via DragOverlay (portaled to the iframe <body> so the frosted container's backdrop-filter doesn't offset its fixed positioning). Snapshot includes ALL visible rows (incl. the dimmed sources) in list-container px (rows scroll together → no scroll offset); the cursor hit-tests this for a visual slot, mapped back to a dragged-excluded `base` index, then applyDropPlacement inserts the whole block. Plain reorder shows one thin high-contrast line (#111 + white ring) hugging a row edge (last-of-A vs first-of-B via boundarySide). Cmd/Ctrl = NEW SECTION at the CURSOR slot (top / between / bottom — resolveDropPlacement asNewSection): a labeled "New section" line at the slot, or a dashed item-sized box past the last note (where there's room); Cmd + cursor at/below the last row's top snaps it to the very end (forgiving bottom drop zone). A plain single-note drop released over the note's OWN original row is a no-op (so a near-zero "select" drag can't merge a sole-item section into its neighbor); dragging onto another note applies normally. Commit on drop via applyDropPlacement. Split: `useNoteSelection` / `useNoteDrag` hooks (src/hooks/), `notesListGeometry` + `notesListConstants` (src/lib/, incl. the pure `resolveDragPreview` hit-test), `DraggableNoteRow` / `DropIndicator` / `DragClone` components.
  Note.tsx           Note card; header = drag handle only while title unfocused. Title edits on a CLEAN click (≤4px = PointerSensor distance), not on mousedown (preventDefault'd then focused in onClick) so click+drag moves instead of editing. Modifier-click (Cmd/Ctrl/Shift) selects via onSelect instead of editing — resolved in onClick so a modifier-drag doesn't also select (dnd-kit suppresses the click after a real drag); isSelected → selection ring.  NoteUrlEditor.tsx URL row + LINK/ANCHOR/COPY/PASTE
  RichTextBodyEditor.tsx contentEditable + execCommand B/I/U, sanitized; body font = Inter; body bg = #D9D9D9 (`bg-note`) with the editor transparent so the dimmed `ModalWatermark` (0.15) reads behind the text
  SubjectTabStrip.tsx Rotated strip + click-vs-dblclick; wheel-scroll uses native CSS scroll-snap (`snap-y snap-mandatory` on the scroll area + `snap-start` on each 3-cell tab) so it settles on a full tab without resting mid-tab     AlphabetIndexRollout.tsx A–Z rail (SELECTED subject's letter = blue, derived from activeSubjectTabId; matching letters hover-cue)
  BrandLockup.tsx    Shared NN logo/wordmark; `BrandLogo(viewBox?)` renders the two-N mark     NnModalFrame.tsx shared dialog shell (Cancel/OK buttons; width = Figma MODAL BG 577px; body `min-h` 214px, content vertically centered) + `ModalWatermark` — the dimmed faint NN behind the body: two N glyphs INLINED as paths (the `src/assets/icons/N_LEFT.svg` 189w + `N_RIGHT.svg` 191.19w shapes; the .svg files themselves are NOT imported, so a glyph change means editing the paths here) laid side-by-side with the design's 3px gap (Figma "OLD LOGO REDO 4" 383.19×120 box; ~71% of body width, centered, natural aspect — NOT the narrow header `BrandLogo`); fills are plain white, opacity comes from the className (0.03 modals / 0.15 note); `-z-10` inside `relative isolate overflow-hidden`. Reused by every dialog + the note body; the empty-state panel (DashboardContent) uses the same watermark with a taller `min-h` 252px body (the two Figma modal heights).
  SubjectTab*Dialog.tsx / NoteDeleteConfirmDialog.tsx dialogs (deletes use CANCEL/OK)     PaywallDialog.tsx full-width trial bar (BrandLockup + BUY + $5); wiring OFF-LIMITS (§7)
  styles.css         Tailwind 4 @theme + iframe-injected styles (?inline import)
src/components/ui/   shadcn primitives, re-themed to h-10 / text-2xl scale (§6)
dist/                Built output (loadable). Built from the configured `.env` (real ExtPay id + prod 7-day trial) → paywall active (§7)
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
`nn-extension-dist.zip` (gitignored). The dev `dist/` is wired to the localhost dev server and will
NOT run off-machine — always `pack` (a production build) for another machine, then refresh the test tab.

Gates: `npm run typecheck`, `npm run lint` (husky pre-commit runs both). No test script/framework.

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

## 6. Responsive sizing — core shipped, gaps remain

**Calibration reference: 16" laptop, 1920×1080, Windows 11 @ 100% scaling.**

Core sizing is done: `src/content/overlayMetrics.ts` (math in `src/lib/panelScaling.ts`) sets a
viewport-proportional panel width (`viewportWidth × REFERENCE_PANEL_WIDTH_PX / REFERENCE_VIEWPORT_PX`,
clamped) and an iframe root-font knob (`rootFontPx = panelWidth/686 × 16`) on every `visualViewport`
resize, so rem lengths scale with the panel; an `--air-cell: calc(100vh/26)` grid drives the A–Z rail, the "+", subject
tabs (3 cells) and the two header bars (1 cell each). The old "no width logic / constant ~758px"
defect is gone.

Still open (minor):
1. **Legacy stored `gapBeforePxByNoteId`** — no longer written (sections are layout groups now, §8),
   but old stored values may exist; account for them on migrate.

Fonts are **self-hosted** (Fjalla One + Inter 400/600/700 + italic): bundled as web-accessible
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
| [src/overlay/PaywallDialog.tsx](src/overlay/PaywallDialog.tsx) | Full-width trial bar: BUY → `onBuy`, LOG IN (restore) → `onLogin`. The `onBuy`/`onLogin`/`onOpenChange`/trial props are the protected wiring; layout-only edits were done with explicit human OK and still need it. |
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

- **"sync" does not mean sync.** `storageService.getAreaName` remaps the `"sync"` namespace to
  `chrome.storage.local` ([storageService.ts:46-47](src/services/storageService.ts#L46-L47)). All
  `NNSync*` types operate on LOCAL storage; nothing syncs across devices.
- **B/I/U via deprecated `document.execCommand`**, body persisted as `innerHTML`. It now passes
  through `sanitizeNoteHtml.ts` on render/emit/paste (the prior stored-XSS hole is closed) — keep
  that sanitizer in the path for any body-HTML change. Body font is Inter (Fjalla One has no real bold).
  The prop→DOM `value` sync is **focus-gated** (adopts external `value` only while unfocused) so the
  async-persist round-trip can't reset `innerHTML` / jump the caret mid-type.
- **The messaging "protocol" is in-memory** (shared realm; function calls, not postMessage).
  background↔content runtime messages are ad-hoc typed per file.
- **Sections are layout groups; `gapBeforePxByNoteId` is legacy-only** — deserialized and migrated by
  `splitGroupsAtSeparationGaps`, never written. Old stored pixel gaps may still exist (migration).
- **Duplicated helpers** (`trimTrailingSlash` ×3, three URL-normalizer flavors) have subtle semantic
  differences — reuse the right one, don't add a fourth.
- **Silent failures:** many empty `catch {}` blocks and no logging anywhere. Don't imitate in new code.

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
  owning folder, content-script modules → `src/content/`. Do not merge new behavior into a file
  already over the cap. Detection is mechanical: ESLint `max-lines` warns at 300 (run
  `npm run lint`), so any file in the 300 zone surfaces every lint. Known over-cap files left as-is
  for now: `NoteUrlEditor.tsx`, `contentPanelBridge.ts`, `App.tsx` (trial logic), `useNoteDrag.ts`
  (310, cohesive).
- **No barrel / re-export facades.** Import each helper directly from the module that defines it;
  never re-export others' symbols (`export … from "…"`) just to keep a stable import surface. When
  you split a file, repoint its consumers to the new modules (don't leave the old file re-exporting).
