"use client";

import { useEffect, useRef, type ComponentProps } from "react";

type Props = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "onCompositionStart" | "onCompositionEnd" | "onKeyDown"
> & {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  minimumLength?: number;
  scope?: string;
};

/** Keep typing immediate; search after a pause or an explicit Enter. */
export function SearchInput({
  value,
  onChange,
  onSearch,
  minimumLength = 0,
  scope,
  ...props
}: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composing = useRef(false);
  const editedValue = useRef(value);
  useEffect(() => () => clearTimeout(timer.current), [scope, props.disabled]);
  useEffect(() => {
    // External resets must also cancel a search queued before the reset.
    if (value !== editedValue.current) clearTimeout(timer.current);
  }, [value]);

  function search(raw: string, immediately = false) {
    clearTimeout(timer.current);
    const term = raw.trim().normalize("NFC");
    const normalized = Array.from(term).length >= minimumLength ? term : "";
    if (immediately || !normalized) onSearch(normalized);
    else timer.current = setTimeout(() => onSearch(normalized), 300);
  }

  return (
    <input
      {...props}
      type="search"
      value={value}
      onChange={(event) => {
        const raw = event.currentTarget.value;
        editedValue.current = raw;
        onChange(raw);
        if (
          !composing.current &&
          !(event.nativeEvent as InputEvent).isComposing
        )
          search(raw);
      }}
      onCompositionStart={() => {
        composing.current = true;
        clearTimeout(timer.current);
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        editedValue.current = event.currentTarget.value;
        onChange(event.currentTarget.value);
        search(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          !composing.current &&
          !event.nativeEvent.isComposing &&
          event.keyCode !== 229
        ) {
          event.preventDefault();
          search(event.currentTarget.value, true);
        }
      }}
    />
  );
}
