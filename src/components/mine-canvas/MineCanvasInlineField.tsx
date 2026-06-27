import { useEffect, useRef, type ElementType, type KeyboardEvent } from "react";

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
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [active]);

  if (!active) {
    const displayClass = `${className}${!value ? " mine-inline-placeholder" : ""}`.trim();
    return (
      <Display
        className={displayClass}
        onDoubleClick={(event: MouseEvent) => {
          event.stopPropagation();
          onBeginEdit();
        }}
      >
        {value || placeholder}
      </Display>
    );
  }

  const sharedProps = {
    className: `mine-inline-input nodrag nopan nowheel ${className}`.trim(),
    defaultValue: value,
    placeholder,
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!composingRef.current) onChange(event.currentTarget.value.trim());
    },
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!composingRef.current) onChange(event.currentTarget.value);
    },
    onCompositionStart: () => {
      composingRef.current = true;
    },
    onCompositionEnd: (event: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      composingRef.current = false;
      onChange(event.currentTarget.value);
    },
    onDoubleClick: (event: React.MouseEvent) => event.stopPropagation(),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onExitEdit();
        return;
      }
      if (!multiline && event.key === "Enter" && !event.nativeEvent.isComposing && !composingRef.current) {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
  };

  return multiline ? (
    <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} rows={2} {...sharedProps} />
  ) : (
    <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" {...sharedProps} />
  );
}
