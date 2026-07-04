# E2E suite (Playwright)

Functional + visual-regression coverage for the NN overlay, driven through the real
extension (service worker → `TOGGLE_OVERLAY` → overlay iframe), exactly like the
toolbar click.

Specs (8): `functional`, `visual`, `navigation` (single-tab persistence + tab reveal
after cross-site nav), `anchor` (cross-page fire + late-layout retry), `link`
(URL trailing-slash + typing), `reorder` (drag-dim cleanup on outside release),
`air` (A–Z clicked-letter highlight), `image-paste` (paste image → sanitized
`<img>`; XSS blocked).

## Run

```bash
npm run test:e2e          # build dist-e2e, run all 34 tests
npm run test:e2e:update   # same, but refresh the visual baselines
npx playwright test functional   # functional specs only (after a build:e2e)
```

Each test boots a fresh Chromium profile with the extension loaded, so windows
open/close per test — that is expected. `--load-extension` needs a real browser;
this Chromium build does not bring the extension up headless (`PW_HEADLESS=1`
exists to retry after Playwright upgrades).

## What runs against what

- `npm run build:e2e` produces **dist-e2e** with `VITE_EXTPAY_EXTENSION_ID` unset:
  no extensionpay.com traffic. The local 7-day trial still runs (red NN button),
  but the clock is frozen (`FIXED_NOW` in fixtures.ts) so it is deterministic.
  Trial/paywall UI is therefore NOT covered by this suite.
- The host page is `https://nn-test.local/`, fulfilled by route interception —
  no server, no network. It must stay **https**: id minting uses
  `crypto.randomUUID`, which only exists in secure contexts.

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

## Not covered yet (candidates for next specs)

Full drag & drop reordering + multi-select drag (only the stuck-dim cleanup is
covered), rich-text B/I/U, COPY/PASTE actions, trial/paywall flows, and LINK/ANCHOR
against **real** sites (the specs use route-stubbed pages — verify Audi/Bugatti by
hand). Notes-list scroll-position restore is also unverified.
