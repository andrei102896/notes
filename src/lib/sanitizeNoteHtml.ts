/** Note-body sanitizer: raw HTML re-injected via innerHTML is a stored-XSS vector, so at every trust boundary (render/save/paste) an inert DOMParser tree is walked down to an allowlist — B/I/U formatting (no attributes) plus <img> with a scheme-validated src. */

/** Formatting tags we keep; everything else is unwrapped to its text. IMG is kept but its src is scheme-validated (see below). */
const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "P",
  "DIV",
  "BR",
  "IMG",
]);

/** Allow only inline raster data-URLs and http(s) images — blocks javascript:, data:text/html, and scriptable svg. */
function isSafeImageSrc(src: string): boolean {
  const s = src.trim();
  if (/^https?:\/\//i.test(s)) {
    return true;
  }
  return /^data:image\/(png|jpe?g|gif|webp|avif|bmp)[;,]/i.test(s);
}

/** Tags removed together with their contents (never just unwrapped). */
const DROP_WITH_CONTENT = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "TEMPLATE",
  "NOSCRIPT",
  "SVG",
  "MATH",
  "LINK",
  "META",
]);

export function sanitizeNoteHtml(html: string): string {
  if (html === "") {
    return "";
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeChildren(doc.body);
  return doc.body.innerHTML;
}

function sanitizeChildren(parent: Node): void {
  // Snapshot first — we mutate the tree (unwrap/remove) while iterating.
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      // Comments / processing instructions — drop.
      node.parentNode?.removeChild(node);
      continue;
    }

    const el = node as Element;
    const tag = el.tagName.toUpperCase();

    if (DROP_WITH_CONTENT.has(tag)) {
      el.remove();
      continue;
    }

    // Recurse before unwrapping so nested text is already clean.
    sanitizeChildren(el);

    if (!ALLOWED_TAGS.has(tag)) {
      unwrap(el);
      continue;
    }

    if (tag === "IMG") {
      // Keep a scheme-validated src only; strip everything else (onerror, srcset, styles…). Unsafe/missing src → drop the image.
      const rawSrc = el.getAttribute("src") ?? "";
      for (const attr of Array.from(el.attributes)) {
        el.removeAttribute(attr.name);
      }
      if (isSafeImageSrc(rawSrc)) {
        el.setAttribute("src", rawSrc);
      } else {
        el.remove();
      }
      continue;
    }

    // Strip every attribute — no styles, no URLs, no event handlers.
    for (const attr of Array.from(el.attributes)) {
      el.removeAttribute(attr.name);
    }
  }
}

/** Replace an element with its children, preserving the text it wrapped. */
function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) {
    el.remove();
    return;
  }
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}
