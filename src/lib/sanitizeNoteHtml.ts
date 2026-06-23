/** Note-body sanitizer: raw HTML re-injected via innerHTML is a stored-XSS vector, so at every trust boundary (render/save/paste) an inert DOMParser tree is walked down to a no-attribute allowlist (B/I/U formatting only). */

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
