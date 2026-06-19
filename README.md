# Notes for Net (NN)

A Manifest V3 Chrome extension: a sticky-note panel anchored to the **right edge** of the
browser window and injected into every page. Click the toolbar icon to slide it in or out.

Notes live under **subject tabs** (folders) and are organized per page:

- **Subject tabs** — vertical, alphabetically-sorted folders down the left of the panel,
  with an **A–Z index rail** to jump between them.
- **Note cards** — a title, a rich-text body (bold / italic / underline), and an
  auto-filled URL and creation date. Each note can be minimized, maximized, deleted, and
  reordered by drag.
- **LINK / ANCHOR / COPY / PASTE** — open the note's saved URL, drop an anchor on the page
  to scroll back to later, and copy/paste notes between tabs.
- A **free trial → purchase** flow (ExtensionPay) behind the logo button, top-right.

Everything is stored locally via `chrome.storage.local`; nothing is sent to a server.

## Running locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` (build-time values — rebuild after changing them; see `.env.example`):

   ```
   VITE_EXTPAY_EXTENSION_ID=<your id from extensionpay.com>
   VITE_TRIAL_MODE=prod
   ```

   - An empty/missing `VITE_EXTPAY_EXTENSION_ID` compiles the paywall out entirely (the BUY
     button becomes a no-op).
   - `VITE_TRIAL_MODE=prod` is the 7-day trial; any other value compiles a 7-minute dev trial.

3. Build:

   ```bash
   npm run build
   ```

4. In Chrome: open `chrome://extensions`, enable **Developer mode**, click **Load
   unpacked**, and select the **`dist/`** folder. Reload any already-open tabs so the
   content script attaches.

5. Open a normal `http/https` page and click the toolbar icon to toggle the panel. (On
   `chrome://` pages, the Web Store, etc. the click does nothing — those pages can't be
   injected.)

Quality gates: `npm run typecheck` and `npm run lint` (run on commit via husky). There is
no test suite yet.

## Project layout

- `src/background.ts` — service worker: relays the toolbar click as `TOGGLE_OVERLAY`, opens
  URLs in new tabs, and broadcasts the ExtensionPay trial/purchase state.
- `src/content.ts` — runs on every page: mounts the right-edge panel shell + iframe, sizes
  the panel proportionally to the viewport, and restores scroll position for note anchors.
- `src/overlay/` — the React UI rendered inside the panel iframe (header, subject-tab strip,
  A–Z rail, note list, note card, dialogs).
- `src/services/nnStorage.ts` — all persistence: a sharded `chrome.storage.local` schema
  with defensive migrations.
- `src/lib/` — pure helpers (note-list layout, URL comparison, A–Z helpers, HTML sanitizer,
  cross-navigation anchor handoff).

See `AGENTS.md` for the full architecture, the responsive-sizing notes, and the areas that
are off-limits for changes.
