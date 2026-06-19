# AGENTS.md — Notes For Net (NN) Chrome Extension

Governance and context file for ALL agent work on this repository. Read this fully
before touching any file. Last full assessment: 2026-06-11 (see `ASSESSMENT_BRIEF_RO.md`
for the complete findings in Romanian). **Progress update: 2026-06-18 — several §6/§8
items below are now resolved; see §10 here and `ASSESSMENT_BRIEF_RO.md` §8 before relying
on the baseline claims.**

---

## 1. Project overview

**Notes For Net (NN)** is a Manifest V3 Chrome extension: a notes panel anchored to the
**right edge** of the browser window, injected into every page. Design intent:

- An **A–Z alphabetical index rail** ("AIR" in code) on the panel's left edge.
- Scrollable, vertical **subject tabs** used as folders (rotated 90°, alphabetically sorted).
- Stacked **note cards**: header (title — a "price" field is in the design but has NO code),
  rich-text body (B/I/U), auto-populated URL and date, LINK/ANCHOR/COPY/PASTE controls,
  min/max/delete.
- A **trial → purchase** flow (ExtensionPay + Stripe) with a logo button top-right.
- A **hide/reveal toggle** via the toolbar icon (no popup, no side panel — the action
  button sends `TOGGLE_OVERLAY` to the active tab).

**Provenance warning:** this code was delivered by an external agency (Tapptitude), which
is off the project and unavailable for questions. It was delivered incomplete and built on
an older "scroll bookmarks" starter — originally the README, the `package.json` name, and
the manifest description all still described that starter rather than the real product
(corrected 2026-06-18, see §10). The de-facto spec exists only as JSDoc comments citing ticket IDs
(NOTES-CORE-*, SUBJECT-TABS-*, AIR-2, NOTE-COPYPASTE, …) and a `anchor-keep-pm/jira.md`
file that is NOT in the repo. Treat every behavior as unverified until traced in code.

## 2. Working rules (mandatory)

- **Agents modify files only and NEVER run git commands — the human owns all git.**
- **List every file touched at the end of each task.**
- **One concern per change.**
- **Never expand scope autonomously.**

Additional repo-specific rules:

- The payment/trial code is **OFF-LIMITS** (see §7). Do not edit it, even to "clean up".
- Read the relevant file before editing it; this codebase has several traps (§8).
- After any TypeScript edit, run `npm run typecheck` and `npm run lint` — both currently
  pass clean and must stay that way (husky pre-commit enforces them).
- There are **zero tests**. Until a test harness exists, every behavioral change must be
  manually verified in a loaded extension build.

## 3. File map

```
manifest.config.ts        MV3 manifest source (consumed by @crxjs/vite-plugin)
vite.config.ts            Vite + react + tailwindcss + crx plugins; "@" → src alias
package.json              name "notes-for-net" (was the stale starter name); scripts below
tsconfig.json             strict, ES2022, bundler resolution, "@/*" path
components.json           shadcn config (style new-york, css = src/overlay/styles.css)
.env.example              VITE_EXTPAY_EXTENSION_ID + VITE_TRIAL_MODE (both documented)
README.md                 describes Notes for Net (rewritten 2026-06-18)
scripts/render-extension-icon.mjs   sharp: SVG → 128px padded PNG
nn-chrome-extension.zip   agency delivery artifact (source-only snapshot, no build)

src/background.ts         Service worker: ExtPay init/onPaid broadcast; action click →
                          TOGGLE_OVERLAY; OPEN_URL_IN_NEW_TAB
src/content.ts            Content script on <all_urls>: mounts the panel shell + iframe,
                          pending-anchor scroll restore, show/hide/toggle. THE sizing file.
src/messaging/
  contentPanelProtocol.ts Versioned message types panel↔content (same-realm, see §8)
  contentPanelBridge.ts   Anchor-pick layer, scroll-to-anchor, panel client API
src/services/
  nnStorage.ts            All persistence: sharded chrome.storage.local schema
                          (nnSyncMeta / nnNoteIndex / nnNote:<id> / nnLayout:<key>),
                          migrations, CRUD, subscribe. 834 lines — the data layer.
  storageService.ts       Typed storage wrapper. WARNING: its "sync" namespace is
                          remapped to chrome.storage.local (§8). Nothing syncs.
src/types/
  nnData.ts               NN domain model + the most accurate JSDoc "spec" in the repo
src/hooks/
  useNNDashboardSession.ts  Central dashboard state hook (storage CRUD + layout + filtering)
  useBrowserTabLocation.ts  Host tab URL tracking (350ms poll + history events)
  useOverlayPortalContainer.ts  Radix portal target inside the iframe
src/lib/
  nnNoteLayout.ts         Note-list layout model; NN_COLLAPSED_NOTE_HEADER_PX = 40 (px trap §8)
  nnDashboardNotes.ts     URL comparison + note visibility rules
  pendingNavigation.ts    Cross-navigation anchor/overlay handoff keys
  airSubjectTabs.ts       A–Z letter helpers          subjectTabName.ts  9-char name clamp
  sessionUrlKey.ts        URL normalization           nnSyncKeys.ts      storage key constants
  browsingContextWindow.ts window.top resolution      utils.ts           cn()
  extpay.ts               ExtPay client singleton — OFF-LIMITS (§7)
src/overlay/              React UI rendered INSIDE the panel iframe
  App.tsx                 Root composition + trial/billing gating (§7 lines are OFF-LIMITS)
  DashboardHeader.tsx     Title bar, Add Note, Min/Max/Delete group, NN logo / trial button
  DashboardContent.tsx    Note list container + copy/paste buffer
  NotesList.tsx           dnd-kit reorder, multi-select, section groups (690 lines)
  Note.tsx                Note card        NoteUrlEditor.tsx  URL row + LINK/ANCHOR/COPY/PASTE (558 lines)
  RichTextBodyEditor.tsx  contentEditable + document.execCommand B/I/U
  SubjectTabStrip.tsx     Rotated tab strip + 280ms click-vs-dblclick logic
  AlphabetIndexRollout.tsx A–Z rail        PaywallDialog.tsx  trial/purchase modal — OFF-LIMITS
  SubjectTab*Dialog.tsx / NoteDeleteConfirmDialog.tsx  dialogs
  styles.css              Tailwind 4 @theme + iframe-injected styles (?inline import)
src/components/ui/        shadcn primitives, re-themed to h-10 / text-2xl scale (§6)
dist/                     Built output (loadable). Current build = DEV artifact: ExtPay id
                          empty, 7-MINUTE trial baked in (§7, §8)
```

## 4. Stack and how to run

Resolved versions (package-lock.json): Vite 5.4.21, @crxjs/vite-plugin 2.5.0 (declared
`^2.0.0-beta.27` — the "beta" is stale; a stable resolves), React 18.3.1
(**but @types/react is 19.x — known mismatch**), TypeScript 6.0.3 (with
`ignoreDeprecations: "6.0"`), Tailwind CSS 4.3.0 (CSS-first, no tailwind.config —
theme lives in `src/overlay/styles.css` `@theme`), radix-ui umbrella 1.5.0, @dnd-kit,
extpay 3.1.2. `@tanstack/react-query` is installed and a provider is mounted but **no
query is ever used** (dead weight in a 415 KB content bundle).

Build & load unpacked:

1. `npm install`
2. Create `.env` (build-time substitution — a rebuild is required after changes):
   - `VITE_EXTPAY_EXTENSION_ID=<id from extensionpay.com>` — empty/missing compiles the
     paywall OUT entirely (`isExtPayConfigured` = false).
   - `VITE_TRIAL_MODE=prod` — anything else (including unset) compiles a **7-minute**
     dev trial instead of 7 days.
3. `npm run build` → emits `dist/`
4. `chrome://extensions` → Developer mode → **Load unpacked** → select the **`dist/`
   folder**. Reload already-open tabs to get the content script.
5. Click the toolbar icon on a normal http/https page to slide the panel in/out.
   (On `chrome://`, the Web Store, etc. the click silently does nothing — by design flaw.)

Quality gates: `npm run typecheck`, `npm run lint` (both pass as of 2026-06-11; husky
pre-commit runs both). There is no test script and no test framework.

## 5. Architecture in one paragraph

`background.ts` (service worker) relays toolbar clicks as `TOGGLE_OVERLAY` runtime
messages. `content.ts` (on `<all_urls>`) appends a fixed-position shell `<div>` to the
host page (right-anchored, z-index 2147483647) containing an about:blank `<iframe>`;
it doc.writes a blank document, injects the entire Tailwind stylesheet as an inline
`<style>` (that's why `dist/` has no .css asset — expected, not broken), and renders the
React `App` into the iframe body **from the content-script realm**, so the panel and the
content script share one JS context (the messaging/ "protocol" is in-memory function
calls, not postMessage). All persistence is `chrome.storage.local` via `nnStorage.ts`.
Height tracks `visualViewport`; width does not track anything (see §6).

## 6. The responsive-sizing mandate (primary known defect)

**Symptom:** UI built/checked on one display renders oversized and misaligned on others.
**Calibration reference: 16" Windows laptop, 1920×1080, Windows 11 @ 100% scaling.**

Root cause (verified, multi-part):

1. **The panel has no width logic at all.** The shell sets only
   `min-width:calc(718px + 0.25rem * 10)` and `max-width:100vw`
   ([content.ts:24](src/content.ts#L24), [content.ts:319-337](src/content.ts#L319-L337)).
   With no `width`, shrink-to-fit collapses to the min-width, so the panel is a constant
   **~758 CSS px** on every screen: 39% of a 1920px viewport, 49% at 1920@125% scaling,
   55% on 1366×768, 59% at 2560@200%. Nothing reads `window.innerWidth`,
   `devicePixelRatio`, or `matchMedia`. Below ~758 CSS px viewport width, min-width beats
   max-width and the panel's left side (AIR rail + tabs) goes off-screen, unreachable.
2. **The interior scale is fixed and large by design:** shadcn primitives were re-themed
   to `h-10` controls and `text-2xl` (24px) text ([button.tsx:27](src/components/ui/button.tsx#L27),
   [tabs.tsx:66](src/components/ui/tabs.tsx#L66)); no responsive breakpoints exist.
3. **px↔rem coupling that only holds at a 16px root:** the iframe never sets a root
   font-size, so Chrome's user font-size setting changes all rem lengths while hardcoded
   px constants stay fixed — e.g. the rotated 120px tabs with `translate-x-[40px]` must
   match the rem-based `w-10` rail ([SubjectTabStrip.tsx:269](src/overlay/SubjectTabStrip.tsx#L269)),
   and `NN_COLLAPSED_NOTE_HEADER_PX = 40` literally documents the 16px assumption
   ([nnNoteLayout.ts:3-4](src/lib/nnNoteLayout.ts#L3-L4)).
4. **The shell min-width's `0.25rem` resolves against the HOST page's root font-size**
   (inline style on a host-page element), so panel width varies per website.
5. The **only** viewport-adaptive value is the AIR letter font
   (`clamp(0.5rem,2.35vmin,1.125rem)`) — it scales while everything beside it is fixed.
6. `styles.css:1` imports Fjalla One from Google Fonts at runtime; host-page CSP can block
   it, swapping font metrics per site (the iframe inherits the embedder's CSP).

**Fix surface** (a complete sizing fix touches roughly these files — keep payment lines
out of any diff): `src/content.ts` (shell width strategy + resize listeners),
`src/overlay/styles.css` (explicit root scale), `src/components/ui/button.tsx`,
`input.tsx` (stray `w-[100px]`), `tabs.tsx`, `src/overlay/SubjectTabStrip.tsx`,
`src/lib/nnNoteLayout.ts` + `src/overlay/NotesList.tsx` (incl. stored px in
`gapBeforePxByNoteId` — a storage migration consideration), `RichTextBodyEditor.tsx`
(`h-[181px]`), `DashboardHeader.tsx` (fixed SVG logos), `App.tsx` (rail calc, line 272
only — beware §7), `PaywallDialog.tsx` geometry (OFF-LIMITS — flag, don't touch),
`AlphabetIndexRollout.tsx`, `NoteUrlEditor.tsx` toolbar rows, dialog offset calcs.

## 7. OFF-LIMITS: payment / trial / purchase code

Do **not** modify any of the following, for any reason, in any task:

| Location | What it is |
|---|---|
| [src/lib/extpay.ts](src/lib/extpay.ts) (whole file) | ExtPay client singleton + `isExtPayConfigured` |
| [src/overlay/App.tsx:19-206](src/overlay/App.tsx#L19-L206) | Trial constants, clock, `refreshBillingAccess`, `isReadOnly` gating, payment-completed listener, `openPaymentPage` |
| `isReadOnly` checks sprinkled through `App.tsx` render (lines ~213-353) | Business gating of every mutation |
| [src/overlay/PaywallDialog.tsx](src/overlay/PaywallDialog.tsx) (whole file) | Trial → purchase modal with BUY button |
| [src/overlay/DashboardHeader.tsx:11-19](src/overlay/DashboardHeader.tsx#L11-L19), [158-171](src/overlay/DashboardHeader.tsx#L158-L171) | Trial logo button wiring (top-right payment access) |
| [src/background.ts:1-28](src/background.ts#L1-L28) | ExtPay `startBackground` + `onPaid` → `PAYMENT_COMPLETED` broadcast |
| [src/content.ts:219-223](src/content.ts#L219-L223) | `PAYMENT_COMPLETED` → `nn-payment-completed` event |
| [manifest.config.ts:34-38](manifest.config.ts#L34-L38) | ExtPay content script on extensionpay.com |
| `.env` / `VITE_EXTPAY_EXTENSION_ID` / `VITE_TRIAL_MODE` handling | Build-time payment config |

**Proximity hazard:** `App.tsx` and `DashboardHeader.tsx` are simultaneously core layout
files AND carry trial wiring. Layout work in these files is allowed only on lines that are
clearly presentation (e.g. `App.tsx:272` rail calc), with the payment lines untouched and
unmoved. When in doubt, stop and flag for the human.

Known state (do not "fix" silently): the shipped `dist/` was built with an empty ExtPay id
and the 7-minute dev trial — payments are entirely disabled in that artifact. This is a
**configuration/rebuild** issue owned by the human, not a code task.

## 8. Known traps (verified)

- **"sync" does not mean sync.** `storageService.getAreaName` remaps the `"sync"`
  namespace to `chrome.storage.local` ([storageService.ts:51-53](src/services/storageService.ts#L51-L53)).
  All `NNSync*` types, `nnSyncKeys.ts`, `subscribeNNSync` operate on LOCAL storage.
  Nothing syncs across devices. The JSDoc claiming "synced" is wrong.
- **`VITE_TRIAL_MODE` is undocumented** (absent from `.env.example`) and defaults to a
  7-minute trial. Any rebuild without it ships dev behavior.
- **Per-keystroke writes:** heading/body edits persist on every input event and trigger
  two full-dataset refetches (hook + storage subscription). Don't add work to that path;
  fixing it is a planned task, not a drive-by.
- **`document.execCommand`** (deprecated) powers B/I/U; note body HTML is persisted raw
  from `innerHTML` and re-injected via `editor.innerHTML = value`
  ([RichTextBodyEditor.tsx:146-154](src/overlay/RichTextBodyEditor.tsx#L146-L154)) with
  **no sanitizer in the repo** and no paste interception — a stored-XSS vector (executes
  in the page-origin iframe, not extension context). Security hardening is a planned task.
- **Dead-but-present code** that looks load-bearing: `OPEN_SCROLL_BOOKMARK` handler,
  `types/bookmark.ts`, `nnSessionsByUrl` per-URL session persistence (implemented, zero
  callers), `reorderNotes`, `PendingSyncMergeState`, the `isActive`/`onHighlightNote`
  prop chains (drilled 4 layers into nothing). Verify callers before building on anything.
- **The messaging "protocol" is in-memory.** Panel and content script share one realm;
  `contentPanelBridge` is function calls, not postMessage. Real runtime messages
  (background ↔ content) are ad-hoc typed per file instead.
- **Stored px:** `gapBeforePxByNoteId` persists raw pixel gaps in storage — any sizing
  rework must account for existing stored values.
- **`tabs` + `activeTab` permissions are likely removable** (nothing uses tabs-permission
  data); don't add code that starts depending on them.
- The duplicated helpers (`trimTrailingSlash` ×3, three URL-normalizer flavors) have
  subtle semantic differences — reuse the right one, don't add a fourth.

## 9. Conventions observed

- TypeScript strict; `unknown`-first parsing of storage payloads; almost no casts.
- Prettier (80 cols, double quotes, semicolons) + ESLint 9 flat config + husky pre-commit.
- Naming: `nn`/`NN` prefix for product code; "AIR" = Alphabetical Index Rollout (the A–Z
  rail); ticket IDs in JSDoc refer to the agency's absent tracker.
- React: function components, forwardRef where needed, props drilled (no context), shadcn
  primitives in `src/components/ui/`.
- Path alias `@/` → `src/`. CSS through Tailwind 4 utilities + `@theme` tokens in
  `styles.css`; one-off CSS only for host-page-level concerns.
- No console logging anywhere and many empty `catch {}` blocks — current code is silent
  about failures (a known weakness; don't imitate it in new code without discussing).

## 10. Progress since 2026-06-11 (Sprint 1) — re-read before relying on §6/§8

Work landed after the baseline. `typecheck`/`lint`/`build` stay clean. These items change
what §6/§8 say is broken — verify against current code before acting on the old claims.
Full status + remaining-work list is in `ASSESSMENT_BRIEF_RO.md` §8.

Resolved / changed:
- **§6 sizing — core shipped.** `content.ts` now sets a viewport-proportional panel width
  (`panelWidth = viewportWidth × REFERENCE_PANEL_WIDTH_PX/REFERENCE_VIEWPORT_PX`, clamped)
  and an iframe root font-size knob (`rootFontPx = panelWidth/686 × 16`) on every
  `visualViewport` resize, so rem sizes scale with the panel. A `--air-cell: calc(100vh/26)`
  grid drives the A–Z rail, the "+" button, subject tabs (3 cells) and the two header bars
  (1 cell each). The "no width logic / constant ~758px" root cause is gone. STILL OPEN:
  hardcoded px constants that don't ride the knob, the stored `gapBeforePxByNoteId`
  migration, and a full multi-resolution QA pass.
- **§8 stored-XSS trap closed.** `src/lib/sanitizeNoteHtml.ts` (allowlist DOMParser
  sanitizer) is applied on render/emit/format/paste in `RichTextBodyEditor.tsx`.
- **Identity (done).** manifest `name`/`description`, `package.json` name, and the **README**
  now describe "Notes for Net"; dead starter code removed (`OPEN_SCROLL_BOOKMARK`,
  `types/bookmark.ts`). Only the internal host element id `#nn-scroll-bookmarks-overlay-host`
  keeps the legacy name (functional; left to avoid breaking the CSS scoped to that id).
- **Permissions trimmed** to `storage`/`scripting`/`unlimitedStorage` (`tabs`+`activeTab`
  removed); `<all_urls>` kept. `.env.example` now documents `VITE_TRIAL_MODE`.
- **Per-URL session persistence appears wired** (`pageSession`/`patchSession` used in
  `App.tsx` + `useNNDashboardSession`) — verify at runtime.
- **Header rebuilt to Figma `css.txt`** + A–Z active-letter highlight, subject-strip
  bottom snap alignment, note-DnD single-separation model + cursor-stick fix.

Unchanged / still off-limits: payment-trial code (§7) and the human-owned paid rebuild
(real ExtPay id + prod trial). react-query is still mounted and Fjalla One still loads from
Google Fonts (both still "dead weight / network dependency" per §6/§5).
