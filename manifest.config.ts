import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Notes for Net",
  description:
    "Save bookmarks with exact scroll position and restore it later.",
  version: "1.0.0",
  permissions: ["storage", "tabs", "activeTab", "unlimitedStorage"],
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
      run_at: "document_idle",
    },
    {
      matches: ["https://extensionpay.com/*"],
      js: ["node_modules/extpay/dist/ExtPay.js"],
      run_at: "document_start",
    },
  ],
});
