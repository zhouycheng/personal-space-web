import { useLayoutEffect, useRef, type ElementType, type KeyboardEvent, type CompositionEvent } from "react";

type MineCanvasInlineFieldProps = {
  active: boolean;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  onBeginEdit: () => void;
  onChange: (value: string) => void;
  onExitEdit: () => void;
  placeholder?: string;
  value: string;
};

export function MineCanvasInlineField({
  active,
  as: Display = "span",
  className = "",
  multiline = false,
  onBeginEdit,
  onChange,
  onExitEdit,
  placeholder,
  value,
}: MineCanvasInlineFieldProps) {
  const fieldRef = useRef<HTMLElement | null>(null);
  const originalValueRef = useRef(value);
  const clickPosRef = useRef<{ x: number; y: number } | null>(null);
  const internalRef = useRef(false);
  const composingRef = useRef(false);

  const prevActiveRef = useRef(false);

  // Enter edit mode: set initial text content, focus, position cursor
  useLayoutEffect(() => {
    const wasInactive = !prevActiveRef.current && active;
    prevActiveRef.current = active;

    if (!active || !fieldRef.current) return;

    if (wasInactive) {
      // Fresh entry to edit mode — populate from prop
      fieldRef.current.textContent = value;
    }
    fieldRef.current.focus();

    if (clickPosRef.current) {
      const { x, y } = clickPosRef.current;
      clickPosRef.current = null;
      requestAnimationFrame(() => {
        if (!fieldRef.current) return;
        try {
          const caret = document.caretPositionFromPoint(x, y);
          if (caret) {
            const range = document.createRange();
            range.setStart(caret.offsetNode, caret.offset);
            range.collapse(true);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        } catch {
          // caretPositionFromPoint not supported — cursor stays at start
        }
      });
    }
  }, [active, value]);

  // Sync external value changes during editing (e.g. undo)
  useLayoutEffect(() => {
    if (!active || !fieldRef.current) return;
    if (internalRef.current) {
      internalRef.current = false;
      return;
    }
    fieldRef.current.textContent = value;
  }, [active, value]);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    clickPosRef.current = { x: event.clientX, y: event.clientY };
    originalValueRef.current = value;
    onBeginEdit();
  };

  const handleBlur = () => {
    if (!fieldRef.current) return;
    internalRef.current = true;
    const text = fieldRef.current.innerText;
    onChange(multiline ? text : text.trim());
  };

  const handleInput = () => {
    if (!fieldRef.current || composingRef.current) return;
    internalRef.current = true;
    onChange(fieldRef.current.innerText);
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLElement>) => {
    composingRef.current = false;
    internalRef.current = true;
    onChange((event.target as HTMLElement).innerText);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      internalRef.current = true;
      onChange(originalValueRef.current);
      onExitEdit();
      return;
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const Tag = multiline ? "div" : Display;
  const isPlaceholder = !value && !active;
  const fieldClass = [
    "mine-inline-field",
    active ? "nodrag nopan nowheel" : "",
    multiline ? "mine-inline-field--multiline" : "",
    className,
    isPlaceholder ? "mine-inline-placeholder" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={fieldRef as React.Ref<HTMLDivElement>}
      className={fieldClass}
      contentEditable={active}
      suppressContentEditableWarning
      onClick={active ? undefined : handleClick}
      onBlur={active ? handleBlur : undefined}
      onInput={active ? handleInput : undefined}
      onCompositionStart={active ? handleCompositionStart : undefined}
      onCompositionEnd={active ? handleCompositionEnd : undefined}
      onKeyDown={active ? handleKeyDown : undefined}
      onPaste={active ? handlePaste : undefined}
    >
      {active ? undefined : (isPlaceholder ? placeholder : value)}
    </Tag>
  );
}
