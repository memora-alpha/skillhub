"use client";
import { useEffect, useRef } from "react";

export function Identifier({
  value,
  onChange,
  label = "Mã người dùng",
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  label?: string;
}>) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.setCustomValidity("");
  }, [value]);
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
