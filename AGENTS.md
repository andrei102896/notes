# AGENTS.md — Notes For Net (NN) Chrome Extension

Governance + context for ALL agent work on this repo. **Read fully before touching any file.**
The 2026-06-11 baseline assessment lives in `ASSESSMENT_BRIEF_RO.md` (Romanian, full history); this
file reflects current state as of 2026-06-21. Treat any documented behavior as unverified until
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

**Provenance:** delivered incomplete by an external agency (Tapptitude, now unavailable), built on
an older "scroll bookmarks" starter. Product identity has since been corrected (README, manifest,
`package.json` all say Notes for Net); the only legacy name kept is the internal host element id
`#nn-scroll-bookmarks-overlay-host` (functional — CSS is scoped to it). The de-facto spec is only
JSDoc citing an absent tracker (`NOTES-CORE-*`, `SUBJECT-TABS-*`, `AIR-2`, …) plus `docs/*.txt` +
`NN_DASHBOARD.png` + `css.txt` (the Figma export). Trace before trusting. **Where the Figma export
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
src/content.ts       Content script on <all_urls>: mounts panel shell + iframe; proportional sizing (THE sizing file); per-tab open-state
                     restore; anchor scroll; uninstall teardown + cross-origin loading veil
src/messaging/       contentPanelProtocol.ts + contentPanelBridge.ts — in-realm panel↔content API (NOT postMessage, §8)
src/services/
  nnStorage.ts       All persistence: sharded chrome.storage.local (nnSyncMeta/nnNoteIndex/nnNote:<id>/nnLayout:<key>), migrations, CRUD (~834 lines)
  storageService.ts  Typed wrapper. WARNING: "sync" namespace is remapped to local (§8) — nothing syncs
src/types/nnData.ts  Domain model + the most accurate JSDoc "spec"
src/hooks/           useNNDashboardSession (central state), useBrowserTabLocation (host URL poll), useOverlayPortalContainer (iframe portal)
src/lib/
  nnNoteLayout.ts    Note-list layout: section = group; resolveDropPlacement/applyDropPlacement (pure); NN_COLLAPSED_NOTE_HEADER_PX=40 (px trap §8)
  tabSession.ts      Per-tab session type {open, activeSubjectTabId, notesScrollTop?} + GET/SET message helpers
  sanitizeNoteHtml.ts  Allowlist DOMParser sanitizer for note-body HTML
  airSubjectTabs.ts  A–Z helpers     nnDashboardNotes.ts URL match + visibility     pendingNavigation.ts cross-nav anchor/overlay keys
  subjectTabName.ts 9-char clamp     sessionUrlKey.ts / nnSyncKeys.ts / browsingContextWindow.ts / utils.ts (cn)
  extpay.ts          ExtPay singleton — OFF-LIMITS (§7)
src/overlay/         React UI inside the panel iframe
  App.tsx            Root composition + trial/billing gating (§7 lines OFF-LIMITS)
  DashboardHeader.tsx Single white-frame button strip (Add Note / nav Min·Max·Delete / Delete Tab / NN); trial button wiring (§7)
  DashboardContent.tsx Note-list container + copy/paste buffer + scroll-position persistence
  NotesList.tsx      Static-list dnd (single note only — no multi-drag): flat column, useDraggable, section groups, frozen-snapshot cursor hit-test. The list NEVER reflows during a drag — the grabbed note dims in place and a faithful clone rides the cursor via DragOverlay (portaled to the iframe <body> so the frosted container's backdrop-filter doesn't offset its fixed positioning). Snapshot includes ALL visible rows (incl. the dimmed source) in list-container px (rows scroll together → no scroll offset); plain reorder hit-tests this for a visual slot, mapped back to a dragged-excluded `base` index for placement. Plain reorder shows one thin high-contrast line (#111 + white ring) hugging a row edge (last-of-A vs first-of-B via boundarySide). Cmd/Ctrl = NEW SECTION, ALWAYS appended below all notes (never between sections): a dashed item-sized placeholder box + "create a new section" label + line, pinned under the last note + a 4rem gap; cursor Y ignored. Commit on drop via applyDropPlacement. (~490 lines)
  Note.tsx           Note card; header = drag handle only while title unfocused. Title edits on a CLEAN click (≤4px = PointerSensor distance), not on mousedown (preventDefault'd then focused in onClick) so click+drag moves instead of editing.  NoteUrlEditor.tsx URL row + LINK/ANCHOR/COPY/PASTE
  RichTextBodyEditor.tsx contentEditable + execCommand B/I/U, sanitized; body font = Inter
  SubjectTabStrip.tsx Rotated strip + click-vs-dblclick     AlphabetIndexRollout.tsx A–Z rail (SELECTED subject's letter = blue, derived from activeSubjectTabId; matching letters hover-cue)
  BrandLockup.tsx    Shared NN logo/wordmark     NnModalFrame.tsx shared dialog shell + Cancel/OK buttons
  SubjectTab*Dialog.tsx / NoteDeleteConfirmDialog.tsx dialogs (deletes use NO/YES)     PaywallDialog.tsx full-width trial bar (BrandLockup + BUY + $5); wiring OFF-LIMITS (§7)
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

Gates: `npm run typecheck`, `npm run lint` (husky pre-commit runs both). No test script/framework.

## 5. Architecture in one paragraph

`background.ts` (SW) relays toolbar clicks as `TOGGLE_OVERLAY` and owns the per-tab session in
`chrome.storage.session` (keyed by `tabId`, cleared on `tabs.onRemoved`). `content.ts` (on
`<all_urls>`) appends a fixed, right-anchored shell `<div>` (z-index 2147483647) holding an
about:blank `<iframe>`, doc.writes a blank doc, and renders React `App` into it via
`overlay/mountOverlayApp.tsx` (which injects the whole Tailwind stylesheet as an inline `<style>`,
so `dist/` has no .css asset — expected). Mounting is **eager and synchronous, from the
content-script realm**, so panel and content script share one JS context (messaging/ is in-memory
function calls, not postMessage). **Do not lazy-load the app via a content-script `import()`:** it
was tried and reverted — the runtime `import()` failed on some strict-CSP sites (e.g. tesla.com),
leaving a visible but empty, click-blocking shell. Eager mount keeps NN reliable on `<all_urls>`
at the cost of the ~420 kB content chunk on every page. All persistence is `chrome.storage.local`
via `nnStorage.ts`. Panel height tracks `visualViewport`; width is viewport-proportional with a
root-font knob (§6).

## 6. Responsive sizing — core shipped, gaps remain

**Calibration reference: 16" laptop, 1920×1080, Windows 11 @ 100% scaling.**

Core sizing is done: `content.ts` sets a viewport-proportional panel width
(`viewportWidth × REFERENCE_PANEL_WIDTH_PX / REFERENCE_VIEWPORT_PX`, clamped) and an iframe
root-font knob (`rootFontPx = panelWidth/686 × 16`) on every `visualViewport` resize, so rem lengths
scale with the panel; an `--air-cell: calc(100vh/26)` grid drives the A–Z rail, the "+", subject
tabs (3 cells) and the two header bars (1 cell each). The old "no width logic / constant ~758px"
defect is gone.

Still open (minor):
1. **Legacy stored `gapBeforePxByNoteId`** — no longer written (sections are layout groups now, §8),
   but old stored values may exist; account for them on migrate.

By design (not a defect, do not re-flag): the UI + note-body fonts load from Google Fonts at runtime
([styles.css:1](src/overlay/styles.css#L1)) — intentional, will not be bundled locally.

Fix surface (keep payment lines out of any diff): `content.ts`, `styles.css`,
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
| [src/content.ts](src/content.ts) ~368–411 | `PAYMENT_COMPLETED` → `nn-payment-completed` event |
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
- **The messaging "protocol" is in-memory** (shared realm; function calls, not postMessage).
  background↔content runtime messages are ad-hoc typed per file.
- **Sections are layout groups; `gapBeforePxByNoteId` is legacy-only** — deserialized and migrated by
  `splitGroupsAtSeparationGaps`, never written. Old stored pixel gaps may still exist (migration).
- **Duplicated helpers** (`trimTrailingSlash` ×3, three URL-normalizer flavors) have subtle semantic
  differences — reuse the right one, don't add a fourth.
- **Silent failures:** many empty `catch {}` blocks and no logging anywhere. Don't imitate in new code.

Resolved since baseline (no longer traps): stored-XSS sanitizer added; `tabs`/`activeTab` permissions
removed; `VITE_TRIAL_MODE` documented in `.env.example`; the dead `nnSessionsByUrl` per-URL session
layer and the `OPEN_SCROLL_BOOKMARK` / `types/bookmark.ts` starter code removed; react-query and
several unused exports (`setNNSync`, `findNotePlacement`, `noteShouldHighlightForBrowserTab`,
`isContentToPanelMessage`) removed. (`EXTPAY_EXTENSION_URL` is still dead but lives in §7 extpay.ts.)

## 9. Conventions

- TS strict; `unknown`-first parsing of storage payloads; almost no casts.
- Prettier (80 cols, double quotes, semicolons) + ESLint 9 flat config + husky pre-commit.
- Naming: `nn`/`NN` for product code; "AIR" = Alphabetical Index Rollout (the A–Z rail). JSDoc ticket
  IDs refer to the agency's absent tracker.
- React function components, forwardRef where needed, props drilled (no context); shadcn primitives in
  `components/ui/`. Path alias `@/` → `src/`. Tailwind 4 utilities + `@theme` tokens in `styles.css`;
  one-off CSS only for host-page-level concerns.
- Comments: one line where possible, describe what/why — never narrate the change you just made; sparse.
