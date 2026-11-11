"use client";
import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  connectionStore,
  connectedState,
} from "@/lib/network/connection-store";
import { retryConnection } from "@/lib/network/api-fetch";
import styles from "./connection-boundary.module.css";

export function ConnectionBoundary({
  children,
}: Readonly<{ children: ReactNode }>) {
  const state = useSyncExternalStore(
    connectionStore.subscribe,
    connectionStore.getSnapshot,
    () => connectedState,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let disposed = false;
    const check = () => {
      void retryConnection();
    };
    const schedule = () => {
      clearTimeout(timer);
      const current = connectionStore.getSnapshot();
      if (!current.reason) attempts = 0;
      if (
        disposed ||
        !current.reason ||
        current.retrying ||
        document.visibilityState === "hidden"
      )
        return;
      timer = setTimeout(
        () => {
          attempts++;
          check();
        },
        Math.min(5000 * 2 ** Math.min(attempts, 3), 30000),
      );
    };
    const offline = () => connectionStore.unavailable("offline");
    const online = () => {
      if (connectionStore.getSnapshot().reason) check();
    };
    const visible = () => {
      if (document.visibilityState === "visible") online();
      else clearTimeout(timer);
    };
    const unsubscribe = connectionStore.subscribe(schedule);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    if (navigator.onLine === false) offline();
    schedule();
    return () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (state.reason) {
      if (!element?.open) element?.showModal();
    } else element?.close();
  }, [state.reason]);
  return (
    <>
      <div className={styles.content} inert={!!state.reason}>
        {children}
      </div>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => event.preventDefault()}
      >
        <div className={styles.icon} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 3 18 18M8.5 8.5a8 8 0 0 1 9.2 1.3M5 12a11 11 0 0 1 2.1-1.5M3 8a15 15 0 0 1 2.3-1.5M9 16a5 5 0 0 1 6 0M12 20h.01" />
          </svg>
        </div>
        <p className={styles.eyebrow}>KẾT NỐI BỊ GIÁN ĐOẠN</p>
        <h2 id={titleId}>
          {state.reason === "offline"
            ? "Bạn đang mất kết nối mạng"
            : "Không thể kết nối với máy chủ"}
        </h2>
        <p id={descriptionId} className={styles.description}>
          {state.reason === "offline"
            ? "Vui lòng kiểm tra Wi-Fi hoặc kết nối mạng của bạn."
            : "Máy chủ hiện chưa phản hồi. Vui lòng thử kết nối lại sau ít giây."}
        </p>
        <p className={styles.hint}>
          Vui lòng giữ trang này mở trong lúc chờ kết nối.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={state.retrying}
          onClick={() => {
            void retryConnection();
          }}
        >
          {state.retrying ? "Đang kết nối lại…" : "Thử kết nối lại"}
        </button>
        <output className={styles.status} aria-live="polite">
          {state.retrying
            ? "Đang kiểm tra kết nối…"
            : "Trang sẽ tự tiếp tục khi kết nối ổn định."}
        </output>
      </dialog>
    </>
  );
}
