import React from "react";

import { createRoot, type Root } from "react-dom/client";

import { App } from "@/overlay/App";
import overlayCss from "@/overlay/styles.css?inline";

/** Injects the overlay CSS into the iframe and mounts the React app; dynamically imported on first open to keep React + Tailwind out of the always-on content bootstrap. */
export function mountOverlayApp(doc: Document, appRoot: HTMLElement): Root {
  const styleEl = doc.createElement("style");
  styleEl.textContent = overlayCss;
  doc.head.appendChild(styleEl);

  const root = createRoot(appRoot);
  root.render(
    React.createElement(React.StrictMode, null, React.createElement(App)),
  );
  return root;
}
