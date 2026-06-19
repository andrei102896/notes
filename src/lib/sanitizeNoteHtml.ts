/**
 * Note-body HTML sanitizer (doc 3_NN_NOTES: the body only supports Bold / Italic
 * / Underline formatting).
 *
 * The contentEditable note body is stored raw and re-injected via `innerHTML`
 * (see {@link file://./../overlay/RichTextBodyEditor.tsx}), and the native paste
 * inserts arbitrary markup — a stored-XSS vector (e.g. a pasted
 * `<img onerror=…>` runs on whichever page later renders the note). We sanitize
 * at every trust boundary (render, save, paste) down to a strict allowlist with
 * NO attributes, so no event handlers, URLs, or inline styles can survive.
 *
 * Implemented with an inert `DOMParser` document — `parseFromString(…, "text/html")`
 * builds a detached tree that never executes scripts or loads resources — plus a
 * tree walk. This avoids bundling a sanitizer library into the content script that
 * is injected on every page, while keeping the audited surface tiny.
 */

/** Formatting tags we keep; everything else is unwrapped to its text. */
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "P", "DIV", "BR"]);

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
