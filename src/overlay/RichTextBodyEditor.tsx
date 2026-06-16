import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

function isRichTextEmpty(html: string): boolean {
  const plain = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return plain.length === 0;
}

export type FormatState = { bold: boolean; italic: boolean; underline: boolean };

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

function formatStateFromSelection(
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

function applyTypingStyle(
  doc: Document,
  desired: FormatState,
): void {
  const commands = ["bold", "italic", "underline"] as const;
  for (const command of commands) {
    const isActiveNow = doc.queryCommandState(command);
    if (isActiveNow !== desired[command]) {
      doc.execCommand(command);
    }
  }
}

export type RichTextBodyEditorHandle = {
  applyFormat: (command: "bold" | "italic" | "underline") => void;
};

type RichTextBodyEditorProps = {
  value: string;
  onChange: (nextHtml: string) => void;
  onInteract: () => void;
  onFormatStateChange?: (state: FormatState) => void;
  /** When true, the contentEditable is locked and bold/italic/underline are no-ops. */
  isReadOnly?: boolean;
};

export const RichTextBodyEditor = forwardRef<
  RichTextBodyEditorHandle,
  RichTextBodyEditorProps
>(function RichTextBodyEditor(
  { value, onChange, onInteract, onFormatStateChange, isReadOnly = false },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isFocusedRef = useRef(false);
  const pendingEnterFormatRef = useRef<FormatState | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    if (editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  const emitValue = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    onChange(editor.innerHTML);
  }, [onChange]);

  const queryFormatState = useCallback(() => {
    const editor = editorRef.current;
    const win = editor?.ownerDocument.defaultView;
    if (!isFocusedRef.current || !onFormatStateChange || !editor || !win) {
      return;
    }
    const sel = win.getSelection();
    const range =
      sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const isRangeInsideEditor = !!range && editor.contains(range.commonAncestorContainer);
    if (!isRangeInsideEditor) {
      pendingEnterFormatRef.current = null;
      onFormatStateChange({ bold: false, italic: false, underline: false });
      return;
    }
    // Sticky enter-state is only for caret typing continuation. If user
    // selects text, toolbar must reflect real formatting of that selection.
    if (pendingEnterFormatRef.current && range && !range.collapsed) {
      pendingEnterFormatRef.current = null;
    }
    if (pendingEnterFormatRef.current) {
      onFormatStateChange(pendingEnterFormatRef.current);
      return;
    }
    const nextState = formatStateFromSelection(win, editor);
    onFormatStateChange(nextState);
  }, [onFormatStateChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const doc = editor.ownerDocument;
    doc.addEventListener("selectionchange", queryFormatState);
    return () => doc.removeEventListener("selectionchange", queryFormatState);
  }, [queryFormatState]);

  const applyFormat = useCallback(
    (command: "bold" | "italic" | "underline") => {
      if (isReadOnly) {
        return;
      }
      const editor = editorRef.current;
      if (!editor) return;
      const doc = editor.ownerDocument;
      const win = doc.defaultView;
      if (!win) return;
      const baseState =
        pendingEnterFormatRef.current ?? formatStateFromSelection(win, editor);
      const nextState: FormatState = {
        ...baseState,
        [command]: !baseState[command],
      };
      // After Enter, keep explicit user toggles in the sticky state so
      // toggling one format does not accidentally clear another one in the UI.
      pendingEnterFormatRef.current = nextState;
      editor.focus();
      doc.execCommand(command);
      onChange(editor.innerHTML);
      if (onFormatStateChange) {
        onFormatStateChange(nextState);
      }
    },
    [isReadOnly, onChange, onFormatStateChange],
  );

  const ensureTypingFormatBeforeInput = useCallback(() => {
    const editor = editorRef.current;
    const win = editor?.ownerDocument.defaultView;
    if (!editor || !win) {
      return;
    }
    const sel = win.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return;
    }
    const range = sel.getRangeAt(0);
    if (!range.collapsed || !editor.contains(range.commonAncestorContainer)) {
      return;
    }

    const doc = editor.ownerDocument;
    const desiredState =
      pendingEnterFormatRef.current ?? formatStateFromSelection(win, editor);
    applyTypingStyle(doc, desiredState);
    onFormatStateChange?.(desiredState);
  }, [onFormatStateChange]);

  useImperativeHandle(ref, () => ({ applyFormat }), [applyFormat]);

  const showPlaceholder = !isFocused && isRichTextEmpty(value);

  return (
    <div className="border-b bg-background">
      <div className="relative">
        {showPlaceholder ? (
          <p className="pointer-events-none absolute top-3 left-3 m-0 text-sm text-muted-foreground">
            Write your note...
          </p>
        ) : null}
        <div
          ref={editorRef}
          role="textbox"
          aria-label="Note body"
          aria-readonly={isReadOnly || undefined}
          data-note-body
          contentEditable={!isReadOnly}
          suppressContentEditableWarning
          onFocus={() => {
            onInteract();
            isFocusedRef.current = true;
            setIsFocused(true);
            queryFormatState();
          }}
          onBlur={() => {
            pendingEnterFormatRef.current = null;
            isFocusedRef.current = false;
            setIsFocused(false);
            emitValue();
            onFormatStateChange?.({ bold: false, italic: false, underline: false });
          }}
          onInput={() => {
            onInteract();
            emitValue();
          }}
          onBeforeInput={(event) => {
            const native = event.nativeEvent as InputEvent;
            if (!native.inputType?.startsWith("insert")) {
              return;
            }
            ensureTypingFormatBeforeInput();
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.altKey
            ) {
              const editor = editorRef.current;
              const win = editor?.ownerDocument.defaultView;
              if (editor && win) {
                event.preventDefault();
                const doc = editor.ownerDocument;
                const desiredState =
                  pendingEnterFormatRef.current ?? formatStateFromSelection(win, editor);
                editor.focus();
                doc.execCommand("insertParagraph");
                // Prevent inherited inline styles (eg. bold ancestor) from leaking
                // into the new line when toolbar state says otherwise.
                doc.execCommand("removeFormat");
                applyTypingStyle(doc, desiredState);
                pendingEnterFormatRef.current = desiredState;
                emitValue();
                onFormatStateChange?.(desiredState);
                return;
              }
            }
            if (!(event.metaKey || event.ctrlKey) || event.altKey) {
              return;
            }
            const key = event.key.toLowerCase();
            if (key === "b" || key === "i" || key === "u") {
              event.preventDefault();
              applyFormat(
                key === "b" ? "bold" : key === "i" ? "italic" : "underline",
              );
            }
          }}
          className="h-[11.3125rem] w-full overflow-y-auto bg-background px-3 py-3 outline-none"
        />
      </div>
    </div>
  );
});
