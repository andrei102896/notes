import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  applyTypingStyle,
  type FormatState,
  formatStateFromSelection,
} from "@/lib/richTextFormat";
import { sanitizeNoteHtml } from "@/lib/sanitizeNoteHtml";
import { ModalWatermark } from "@/overlay/NnModalFrame";

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
    // While focused the contentEditable is the source of truth; adopt external values only when unfocused, else innerHTML resets and the caret jumps.
    if (!editor || isFocused) {
      return;
    }
    const safe = sanitizeNoteHtml(value);
    if (editor.innerHTML !== safe) {
      editor.innerHTML = safe;
    }
  }, [value, isFocused]);

  const emitValue = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    onChange(sanitizeNoteHtml(editor.innerHTML));
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
    // Sticky enter-state is only for caret typing continuation; a real selection must reflect its own formatting.
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
      // Keep explicit toggles in the post-Enter sticky state so toggling one format doesn't clear another in the UI.
      pendingEnterFormatRef.current = nextState;
      editor.focus();
      doc.execCommand(command);
      onChange(sanitizeNoteHtml(editor.innerHTML));
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

  return (
    <div className="relative isolate overflow-hidden border-b bg-note">
      {/* Same NN watermark as the modals, dimmed to 0.15 for the light note body. */}
      <ModalWatermark className="opacity-[0.15]" />
      <div>
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
          onPaste={(event) => {
            if (isReadOnly) {
              return;
            }
            const data = event.clipboardData;
            const doc = editorRef.current?.ownerDocument;
            if (!data || !doc) {
              return;
            }
            // Never let raw clipboard markup reach the DOM: sanitize HTML to the B/I/U subset, else insert plain text (onInput emits).
            event.preventDefault();
            const html = data.getData("text/html");
            if (html) {
              doc.execCommand("insertHTML", false, sanitizeNoteHtml(html));
            } else {
              doc.execCommand("insertText", false, data.getData("text/plain"));
            }
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
                // removeFormat stops inherited inline styles (eg. a bold ancestor) leaking into the new line against toolbar state.
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
          className="h-[11.3125rem] w-full overflow-y-auto bg-transparent px-3 py-3 outline-none"
        />
      </div>
    </div>
  );
});
