"use client";
import { useEffect, useRef } from "react";
import { SearchInput } from "@/components/search-input";

export function Identifier({
  value,
  onChange,
  label = "Mã người dùng",
  onSearch,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  label?: string;
  onSearch?: (value: string) => void;
}>) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.setCustomValidity("");
  }, [value]);
  if (onSearch) {
    return (
      <label>
        {label}
        <SearchInput
          className="input"
          aria-label={label}
          value={value}
          onChange={onChange}
          minimumLength={36}
          onSearch={(term) =>
            onSearch(
              /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(term)
                ? term
                : "",
            )
          }
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          spellCheck={false}
          autoCapitalize="none"
        />
      </label>
    );
  }
  return (
    <label>
      {label}
      <input
        ref={input}
        className="input"
        required
        value={value}
        onChange={(event) => {
          event.currentTarget.setCustomValidity("");
          onChange(event.currentTarget.value.trim());
        }}
        onInvalid={(event) => {
          const field = event.currentTarget;
          field.setCustomValidity(
            field.validity.valueMissing
              ? `Vui lòng nhập ${label.toLocaleLowerCase("vi")}.`
              : `${label} chưa đúng định dạng. Dán mã đầy đủ 36 ký tự, gồm 5 nhóm ngăn bằng dấu gạch ngang; không thêm tiền tố hoặc mã rút gọn.`,
          );
        }}
        pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        spellCheck={false}
        autoCapitalize="none"
      />
    </label>
  );
}
