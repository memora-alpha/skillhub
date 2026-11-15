import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import type { UploadedFile } from "@/lib/http/file-upload";
import { filePickerError } from "@/lib/http/file-picker-error";
import {
  watchUploadStatus,
  UploadScanPending,
  UPLOAD_SCAN_PENDING_MESSAGE,
  UPLOAD_SCAN_TIMEOUT_MS,
} from "@/lib/http/watch-upload-status";
import { Button } from "./Button";
import { FormNotice } from "./FormNotice";

export function AutomaticFileStatus(
  props: Readonly<{
    files: UploadedFile[];
    onChange: (files: UploadedFile[]) => void;
    status: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<{ fileId: string; state: string }>;
    isCurrent: () => boolean;
    enabled: boolean;
  }>,
) {
  const latest = useRef(props);
  latest.current = props;
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string>();
  const visible = useRef({ focused, foreground });
  visible.current = { focused, foreground };
  const running = useRef<AbortController | null>(null);
  const ids = props.files.map((file) => file.fileId).join(":");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      visible.current.foreground = state === "active";
      if (state !== "active") running.current?.abort();
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    setError(undefined);
    if (!props.enabled || !focused || !foreground || !ids) return;
    const request = new AbortController();
    running.current = request;
    const ownerIsCurrent = latest.current.isCurrent;
    const active = () =>
      !request.signal.aborted &&
      visible.current.focused &&
      visible.current.foreground &&
      latest.current.enabled &&
      ownerIsCurrent() &&
      latest.current.isCurrent();
    const deadline = setTimeout(() => {
      if (active()) setError(UPLOAD_SCAN_PENDING_MESSAGE);
      request.abort();
    }, UPLOAD_SCAN_TIMEOUT_MS);
    void watchUploadStatus({
      files: () => latest.current.files,
      read: (id, signal) => latest.current.status(id, signal),
      update: (files) => {
        if (!active()) return;
        latest.current = { ...latest.current, files };
        latest.current.onChange(files);
      },
      active,
      signal: request.signal,
    })
      .catch((cause) => {
        if (active())
          setError(
            cause instanceof UploadScanPending
              ? cause.message
              : filePickerError(cause, "status"),
          );
      })
      .finally(() => {
        clearTimeout(deadline);
        if (running.current === request) running.current = null;
      });
    return () => {
      clearTimeout(deadline);
      request.abort();
    };
  }, [ids, props.enabled, focused, foreground, attempt]);
  if (!error) return null;
  return (
    <>
      <FormNotice tone="warning" compact>
        {error}
      </FormNotice>
      <Button
        variant="paper"
        size="sm"
        disabled={!props.enabled || !focused || !foreground}
        onPress={() => setAttempt((value) => value + 1)}
      >
        Thử lại kiểm tra tệp
      </Button>
    </>
  );
}
