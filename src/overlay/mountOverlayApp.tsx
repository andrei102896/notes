import React from "react";

import { createRoot, type Root } from "react-dom/client";

import fjallaRegularUrl from "@/assets/fonts/FjallaOne-Regular.ttf";
import interBoldUrl from "@/assets/fonts/Inter_18pt-Bold.ttf";
import interSemiBoldUrl from "@/assets/fonts/Inter_18pt-SemiBold.ttf";
import interItalicUrl from "@/assets/fonts/Inter_24pt-MediumItalic.ttf";
import interRegularUrl from "@/assets/fonts/Inter_24pt-Regular.ttf";
import { App } from "@/overlay/App";
import overlayCss from "@/overlay/styles.css?inline";

/** Self-hosted @font-face set, built at runtime so each src is an absolute chrome-extension:// URL — the overlay iframe is host-origin, so the bundler's root-relative asset path would otherwise resolve against the page. Bundling replaces the Google Fonts CDN (which failed offline + on strict-CSP pages). */
function buildFontFaceCss(): string {
  const face = (
    family: string,
    style: string,
    weight: string,
    assetUrl: string,
  ): string =>
    `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url("${chrome.runtime.getURL(assetUrl)}") format("truetype");}`;
  return [
    face("Fjalla One", "normal", "400", fjallaRegularUrl),
    face("Inter", "normal", "400", interRegularUrl),
    face("Inter", "normal", "600", interSemiBoldUrl),
    face("Inter", "normal", "700", interBoldUrl),
    face("Inter", "italic", "400 700", interItalicUrl),
  ].join("");
}

/** Injects the overlay CSS into the iframe and mounts the React app; dynamically imported on first open to keep React + Tailwind out of the always-on content bootstrap. */
export function mountOverlayApp(doc: Document, appRoot: HTMLElement): Root {
  const fontStyleEl = doc.createElement("style");
  fontStyleEl.textContent = buildFontFaceCss();
  doc.head.appendChild(fontStyleEl);

  const styleEl = doc.createElement("style");
  styleEl.textContent = overlayCss;
  doc.head.appendChild(styleEl);

  const root = createRoot(appRoot);
  root.render(
    React.createElement(React.StrictMode, null, React.createElement(App)),
  );
  return root;
}
