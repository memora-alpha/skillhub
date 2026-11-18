import type { ComponentPropsWithRef } from "react";
import styles from "./loading-button.module.css";

type Props = ComponentPropsWithRef<"button"> & { loading?: boolean };

export function LoadingButton({
  loading = false,
  children,
  className = "",
  disabled,
  type = "submit",
  ...props
}: Readonly<Props>) {
  const busyClass = loading ? " " + styles.busy : "";
  const buttonProps = {
    ...props,
    className: `${className} ${styles.button}${busyClass}`,
    disabled: disabled || loading,
    "aria-busy": loading || props["aria-busy"],
    "aria-label": loading
      ? (props["aria-label"] ?? "Đang xử lý yêu cầu")
      : props["aria-label"],
  };
  const content = (
    <>
      <span className={styles.content}>{children}</span>
      {loading && (
        <span className={styles.placeholder} aria-hidden="true">
          <span />
        </span>
      )}
    </>
  );
  if (type === "reset")
    return (
      <button {...buttonProps} type="reset">
        {content}
      </button>
    );
  return (
    <button {...buttonProps} type={type === "button" ? "button" : "submit"}>
      {content}
    </button>
  );
}
