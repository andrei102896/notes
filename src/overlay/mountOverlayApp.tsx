import React from "react";

import { createRoot, type Root } from "react-dom/client";

import { App } from "@/overlay/App";
import overlayCss from "@/overlay/styles.css?inline";

/**
 * Injects the overlay stylesheet into the iframe document, then mounts the React app and
 * returns its root. Dynamically imported by content.ts on first overlay open so React + the
 * Tailwind CSS stay out of the always-on content-script bootstrap (loaded only when NN opens).
 */
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
