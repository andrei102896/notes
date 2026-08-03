# E2E suite (Playwright)

> The 6 `__screenshots__/visual.spec.ts/*.png` baselines are the **current design**, last regenerated
> **2026-08-01** (client feedback round: first-run panel, blue-line stack, metal-bar layers, statement box,
> note-body treatment). Refresh them with `npm run test:e2e:update` (calibration machine only) after an
> intended design change — and review each PNG, since `maxDiffPixelRatio` hides small-area changes.

Functional + visual-regression coverage for the NN overlay, driven through the real
extension (service worker → `TOGGLE_OVERLAY` → overlay iframe), exactly like the
toolbar click.

Specs (27 in the default run, plus the opt-in `session-persistence.live` — the redesign and the
2026-07-31 behaviour work added `paywall`, `modal-backdrop`, `subject-tab-sizing`, `metal-bar`,
`scrollbar`, `panel-shadow`, `nav-strip-frame`, `session-persistence`; the 2026-07-31 → 08-01 client
feedback added `metal-bar-layers` (the bar's flanking layers, taken from the client's crop rather than
their Figma CSS), `blue-line` (the accent line + white bar + the shadow that must die before the first
note), `paywall-statement` (the statement box + the background squares' spread) and `first-run-swap`
(clicking "+" swaps the box without the backdrop reloading); 2026-08-02 added `modal-label-centre` (every
modal box's label ink is vertically centred, purchase boxes included) and `note-title-clipping` (the note
title input is not cropped by a text-box trim)): `functional`, `visual`,
`navigation` (single-tab persistence + subject-tab
strip scroll restore after cross-site nav), `anchor` (cross-page fire + late-layout retry),
`anchor-persist` (overlay stays visible after an anchor pick — the host shell, not just the
iframe button), `http-context` (create tab + note on a plain-http non-secure page — the
`generateId` randomUUID→getRandomValues fallback), `link` (URL trailing-slash + typing),
`reorder` (drag-dim cleanup on outside release), `air` (A–Z clicked-letter highlight),
`image-paste` (paste image → sanitized
`<img>`; XSS blocked), `brand` (NN glyph + header text centered in their boxes —
geometric, not a screenshot), `note-actions` (action labels stay Fjalla Regular;
divider closes the group after PASTE).

## Run

```bash
npm run test:e2e          # build dist-e2e, run the whole hermetic suite (81 tests / 27 specs)
npm run test:e2e:update   # same, but refresh the visual baselines
npm run test:e2e:live     # *.live.spec.ts against REAL sites (ford.com + bugatti.com; needs network)
npx playwright test functional   # functional specs only (after a build:e2e)
```

`*.live.spec.ts` is excluded from the default run (`testIgnore`, lifted by `NN_LIVE=1`): it depends on the
internet and on sites that change. Run it for navigation/restore work, because stub pages are always
bfcache-eligible while the real sites are not — opposite code paths.

**With zero subject tabs the panel is in its first-run state**, whose full-panel backdrop covers the nav row,
the A–Z rail and the strip: the trial badge cannot be clicked and a pixel scan over the strip's `+` reads the
backdrop. Specs that need either must `createSubjectTab` first. That helper also re-decides which `+` to click
and retries — the panel mounts after an async storage read, so resolving the target once could aim at the
strip's `+` just before the backdrop covered it, and the dialog never opened (only ever reproduced in
full-suite runs).

Each test boots a fresh Chromium profile with the extension loaded, so windows
open/close per test — that is expected. The profile keeps the browser's
back/forward cache ON (Playwright disables it by default); a bfcache restore
fires no `load` event, so navigation waits must use `waitUntil: "commit"`. `--load-extension` needs a real browser;
this Chromium build does not bring the extension up headless (`PW_HEADLESS=1`
exists to retry after Playwright upgrades).

## What runs against what

- `npm run build:e2e` produces **dist-e2e** with `VITE_EXTPAY_EXTENSION_ID` unset:
  no extensionpay.com traffic. The local 7-day trial still runs (red NN button),
  but the clock is frozen (`FIXED_NOW` in fixtures.ts) so it is deterministic.
  Trial/paywall UI is therefore NOT covered by this suite.
- The host page is `https://nn-test.local/`, fulfilled by route interception —
  no server, no network. Most specs use https as the representative case; the
  `http-context` spec runs a plain-`http://` page to cover the `generateId`
  `getRandomValues` fallback — id minting no longer requires a secure context.

## Visual baselines

`__screenshots__/` is the approved current design and IS committed. A red diff
means the design changed: if unintended, fix the regression; if intended, rerun
with `test:e2e:update` and review the new PNGs in the diff.

**Baselines are calibrated to one machine.** Font antialiasing differs across OS /
hardware, so on another machine every overlay screenshot can show a small (~1–2%)
diff that exceeds the strict `maxDiffPixelRatio` — that is environmental, not a
regression. Only refresh baselines (`test:e2e:update`) on the calibration machine,
and eyeball the PNGs before committing them.

## Quirks the helpers encode (don't fight them in specs)

- Subject tabs (rotate-90 + translate) paint correctly, but their
  `getBoundingClientRect` is a square overlapping the A–Z strip, so plain
  `locator.click()` hits an index letter and synthetic `el.click()` misses the
  mousedown Radix Tabs selects on. Use `clickSubjectTab` / `dblclickSubjectTab`.
- The notes list re-renders async after a tab switch; assert titles with the
  polling `expectTitles`, never a one-shot read.
- **After a bfcache Back, Playwright's frame handle is stale** — any `frameLocator` on the
  overlay iframe hangs even though the panel is there. Read it through
  `page.evaluate` on `iframe.contentDocument` (same-origin); see `panelState` in
  `session-persistence.spec.ts`.
- A flash lasting a frame or two is over before a `page.evaluate` can start. Count it
  from inside with an `addInitScript` rAF counter (`PAGE_PROBE` in the same spec).

## Not covered yet (candidates for next specs)

Full drag & drop reordering + multi-select drag (only the stuck-dim cleanup is
covered), rich-text B/I/U, COPY/PASTE actions, trial/paywall flows, and LINK/ANCHOR
against **real** sites (the specs use route-stubbed pages — verify Audi/Bugatti by
hand; the min/max + slide-in restore IS covered on real sites by `session-persistence.live`).
Notes-list scroll-position restore is also unverified.
