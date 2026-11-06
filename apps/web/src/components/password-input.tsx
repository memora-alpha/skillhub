"use client";

import { useId, useState, type ComponentPropsWithRef } from "react";
import { Icon } from "./console/icon";
import styles from "./password-input.module.css";

type Props = Omit<ComponentPropsWithRef<"input">, "type"> & {
  visibilityLabel?: string;
};

export function PasswordInput({
  id,
  disabled,
  visibilityLabel = "mật khẩu",
  ...props
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const label = (visible ? "Ẩn " : "Hiện ") + visibilityLabel;
  return (
    <span className={styles.field}>
      <input
        spellCheck={false}
        autoCapitalize="none"
        {...props}
        id={inputId}
        disabled={disabled}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className={styles.toggle}
        disabled={disabled}
        aria-label={label}
        title={label}
        aria-controls={inputId}
        aria-pressed={visible}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => setVisible((value) => !value)}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={20} />
      </button>
    </span>
  );
}
