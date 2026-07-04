# HANDOFF — Notes for Net (NN)

Everything needed to build, configure, and ship this Manifest V3 Chrome extension.
For day-to-day local running see [`README.md`](README.md); for architecture and
code conventions see [`AGENTS.md`](AGENTS.md).

---

## 1. Prerequisites

- **Node.js** 18+ and **npm**.
- A **Chrome / Chromium** browser for loading and testing.
- An **[extensionpay.com](https://extensionpay.com)** account + a connected **Stripe**
  account (only if payments are in scope — see §5).

```bash
npm install
```

---

## 2. Environment configuration

Build-time values live in a **`.env`** file at the repo root. **`.env` is gitignored**, so
it is *not* in the repo and must be created on each machine that builds. Copy the template:

```bash
cp .env.example .env
```

Required values:

| Variable | Value | Notes |
|---|---|---|
| `VITE_EXTPAY_EXTENSION_ID` | `notes-for-net` | The exact extension id registered on extensionpay.com. **Must match character-for-character** or payments/trial silently break. An empty value compiles the paywall out entirely (everything becomes free). |
| `VITE_TRIAL_MODE` | `prod` | `prod` = 7-day free trial. Any other value = 7-minute trial (dev only). Ship `prod`. |

> ⚠️ These values are **compiled into the bundle at build time**. Always set `.env`
> correctly **before** building/packaging — there is no fixing it in an already-built `dist/`
> or zip without rebuilding.

---

## 3. Build & package for the Chrome Web Store

```bash
npm run pack
```

This runs `vite build` then zips `dist/` to **`nn-extension-dist.zip`** (gitignored) — the
artifact you upload to the Chrome Web Store. (`npm run build` alone produces the unpacked
`dist/` without zipping.)

> Do **not** ship a `npm run dev` build: that `dist/` is tied to the localhost dev server and
> will not run on another machine. Always use `pack` / `build` for distribution.

---

## 4. Loading & testing the build

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/`
   (or unzip `nn-extension-dist.zip` and select that folder).
2. **Reload any already-open tabs** so the content script attaches.
3. Open a normal `http/https` page and click the toolbar icon to toggle the panel.
   (`chrome://` pages, the Web Store, and other restricted pages can't be injected — the
   click does nothing there, by design.)

Smoke-test before shipping: `npm run test:e2e` covers the basics (toggle, tabs, notes,
deletes, persistence — see §7); still exercise by hand what it can't: drag-reorder
(multi-select with Cmd/Ctrl- or Shift-click, then drag them together; Cmd/Ctrl-drag to drop
into a new section), LINK/ANCHOR on a real page, and the trial → buy flow.

---

## 5. Payments (ExtensionPay + Stripe) — dashboard setup

The **code wiring is complete** (storage permission, the extensionpay.com content script in
the manifest, `startBackground()` + the `onPaid` live-unlock in the service worker, and the
buy/login flows in the UI). What remains is **account configuration on extensionpay.com** —
none of it is in the repo:

- [ ] An extension registered with the id **exactly** `notes-for-net`.
- [ ] A **Stripe account connected** — without it no payments can be collected.
- [ ] A **price / plan configured** — `openPaymentPage()` shows whatever the dashboard
      defines; with no plan there is nothing to buy.
- [ ] The **free-trial length** set to match `VITE_TRIAL_MODE=prod` (7 days).

### ⚠️ Ownership transfer (do this for a real handoff)

Payments flow to **whoever owns the extensionpay.com account + Stripe** for `notes-for-net`.
For the client to receive the money, **either**:

- transfer the extensionpay.com account (and its Stripe connection) to the client, **or**
- have the client create their own extensionpay.com account, register the extension, connect
  their Stripe, then update `VITE_EXTPAY_EXTENSION_ID` to their id and rebuild.

If this is skipped, payments go to the original developer's Stripe.

---

## 6. Chrome Web Store submission

1. Upload `nn-extension-dist.zip` at the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Provide store listing assets (icon, screenshots, description) and a privacy disclosure.
   Note for the privacy form: all note data is stored **locally** via `chrome.storage.local`
   and nothing is sent to a server (the only external contact is extensionpay.com for the
   payment/trial flow).
3. The manifest requests `<all_urls>` host access (the panel injects on every page),
   `storage`, `unlimitedStorage`, and `scripting` — be ready to justify these in review.

---

## 7. Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
```

Both run automatically on commit via a husky pre-commit hook. There is also an **automated
e2e suite**:

```bash
npm run test:e2e          # Playwright: 34 tests / 8 specs (functional, visual, navigation, anchor, link, reorder, air, image-paste)
npm run test:e2e:update   # refresh the visual baselines after an INTENDED design change
```

It drives the real extension in a headed Chromium (windows opening per test is expected) against
an ExtPay-disabled build (`dist-e2e`). It covers subject-tab create/persist/scroll, A–Z highlight,
LINK, anchor navigation, and note-body image paste (against stubbed pages). Still NOT covered —
trial/paywall, full drag-reorder + multi-select (only the stuck-dim cleanup is), rich-text B/I/U,
note COPY/PASTE, and LINK/ANCHOR on **real** sites — verify those in a loaded build (see §4).
Scope + quirks: [`tests/e2e/README.md`](tests/e2e/README.md).

`npm run lint` also emits **non-blocking** `max-lines` warnings for any file over the 300-LOC house
cap (see [`AGENTS.md`](AGENTS.md) §9). These are informational — they do not fail the gate; a few
known-large files (`NoteUrlEditor.tsx`, `contentPanelBridge.ts`, `App.tsx`, `useNoteDrag.ts`) are
left as-is for now.

---

## 8. Repo orientation

- [`README.md`](README.md) — product summary + local-run instructions.
- [`AGENTS.md`](AGENTS.md) — full architecture, responsive-sizing notes, and the
  payment/trial code that is **off-limits** for edits.
- [`tests/e2e/README.md`](tests/e2e/README.md) — the e2e suite: how to run, baseline policy, quirks.
- `docs/` + `css.txt` + `docs/NN_DASHBOARD.png` — the design source of truth (Figma export +
  attribute specs) as **client-provided snapshots**: they are not updated when the app changes.
  Check [`docs/DESIGN_SOURCES_STATUS.md`](docs/DESIGN_SOURCES_STATUS.md) for known divergences
  before relying on them. Where docs and the Figma export disagree, **Figma wins**; code is the
  final truth.
