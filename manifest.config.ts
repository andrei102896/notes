import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Notes for Net",
  description:
    "Save and notate any webpage as sticky notes filed under subject tabs, with one-click links and exact-position anchors.",
  version: "1.0.0",
  permissions: ["storage", "scripting", "unlimitedStorage"],
  host_permissions: ["<all_urls>"],
  icons: {
    16: "src/assets/icons/extension-icon.png",
    48: "src/assets/icons/extension-icon.png",
    128: "src/assets/icons/extension-icon.png",
  },
  action: {
    default_title: "Notes for Net",
    default_icon: {
      16: "src/assets/icons/extension-icon.png",
      48: "src/assets/icons/extension-icon.png",
      128: "src/assets/icons/extension-icon.png",
    },
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content.ts"],
      // document_start so a tab-session restore can paint the overlay before the
      // page itself paints — the overlay must not visibly close across same-tab
      // navigation (docs/1_NN_DASHBOARD — temporary persistence).
      run_at: "document_start",
    },
    {
      matches: ["https://extensionpay.com/*"],
      js: ["node_modules/extpay/dist/ExtPay.js"],
      run_at: "document_start",
    },
  ],
});
