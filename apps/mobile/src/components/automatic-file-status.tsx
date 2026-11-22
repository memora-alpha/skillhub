import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import type { UploadedFile, UploadStatus } from "@/lib/http/file-upload";
import { filePickerError } from "@/lib/http/file-picker-error";
import {
  watchUploadStatus,
  uploadNeedsCheck,
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
    status: (id: string, signal?: AbortSignal) => Promise<UploadStatus>;
    isCurrent: () => boolean;
    enabled: boolean;
    onError?: (message: string | undefined) => void;
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
  const waiting = props.files.some((file) =>
    uploadNeedsCheck(file.state, file.moderationStatus),
  );
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
    latest.current.onError?.(undefined);
    if (!props.enabled || !focused || !foreground || !waiting) return;
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
    const showError = (message: string) => {
      if (!active()) return;
      setError(message);
      latest.current.onError?.(message);
    };
    const deadline = setTimeout(() => {
      showError(UPLOAD_SCAN_PENDING_MESSAGE);
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
        showError(
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
  }, [ids, waiting, props.enabled, focused, foreground, attempt]);
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
