# Scroll Bookmarks Overlay (Chrome Extension)

Chrome extension (Manifest V3) using a React overlay injected in the active tab.

It saves:

- the page URL
- the tab title
- the scroll position (`scrollY`)

When you open a bookmark, the extension opens the page and restores the scroll position.

## Running locally

1. Install dependencies:

```bash
npm install
```

2. Build:

```bash
npm run build
```

3. In Chrome:

- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the `dist` folder

4. Open a normal `http/https` page and click the extension icon to toggle the overlay.

## Project layout

- `src/overlay/` — React UI reused by the overlay
- `src/background.ts` — toggles the overlay and opens bookmark tabs
- `src/content.ts` — mounts overlay, reads and restores scroll position
- `src/services/storageService.ts` — typed wrapper around `chrome.storage.local`
