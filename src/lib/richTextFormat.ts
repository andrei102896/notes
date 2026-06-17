export type FormatState = { bold: boolean; italic: boolean; underline: boolean };

export function isRichTextEmpty(html: string): boolean {
  const plain = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return plain.length === 0;
}

function isComputedFontBold(cs: CSSStyleDeclaration): boolean {
  if (cs.fontWeight === "bold" || cs.fontWeight === "bolder") {
    return true;
  }
  const n = parseInt(cs.fontWeight, 10);
  return !Number.isNaN(n) && n >= 600;
}

/** `document.queryCommandState` is wrong for nested &lt;b&gt;&lt;i&gt;…&lt;/i&gt;&lt;/b&gt; in Chrome; drive toolbar from DOM + computed style. */
function probeFormatAtNode(
  win: Window,
  editor: HTMLElement,
  node: Node,
): FormatState {
  let bold = false;
  let italic = false;
  let underline = false;

  let cur: Node | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Node | null);
  while (cur && cur !== editor) {
    if (cur instanceof HTMLElement) {
      const tag = cur.tagName;
      if (tag === "B" || tag === "STRONG") {
        bold = true;
      }
      if (tag === "I" || tag === "EM") {
        italic = true;
      }
      if (tag === "U") {
        underline = true;
      }
    }
    cur = cur.parentNode;
  }

  const el: HTMLElement | null =
    node.nodeType === Node.TEXT_NODE
      ? (node.parentElement as HTMLElement | null)
      : node instanceof HTMLElement
        ? node
        : null;
  if (el) {
    const cs = win.getComputedStyle(el);
    if (isComputedFontBold(cs)) {
      bold = true;
    }
    if (cs.fontStyle === "italic" || cs.fontStyle === "oblique") {
      italic = true;
    }
    const line = cs.textDecorationLine || cs.textDecoration;
    if (line.includes("underline")) {
      underline = true;
    }
  }

  return { bold, italic, underline };
}

export function formatStateFromSelection(
  win: Window,
  editor: HTMLElement,
): FormatState {
  const sel = win.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { bold: false, italic: false, underline: false };
  }
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    return { bold: false, italic: false, underline: false };
  }

  const start = probeFormatAtNode(win, editor, range.startContainer);
  const end = probeFormatAtNode(win, editor, range.endContainer);
  if (range.collapsed) {
    const doc = win.document;
    // For a collapsed caret, the toolbar should reflect how newly typed text
    // will be formatted, not only what wrappers exist around the caret node.
    return {
      bold: doc.queryCommandState("bold"),
      italic: doc.queryCommandState("italic"),
      underline: doc.queryCommandState("underline"),
    };
  }
  return {
    bold: start.bold && end.bold,
    italic: start.italic && end.italic,
    underline: start.underline && end.underline,
  };
}

export function applyTypingStyle(doc: Document, desired: FormatState): void {
  const commands = ["bold", "italic", "underline"] as const;
  for (const command of commands) {
    const isActiveNow = doc.queryCommandState(command);
    if (isActiveNow !== desired[command]) {
      doc.execCommand(command);
    }
  }
}
