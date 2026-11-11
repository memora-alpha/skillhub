import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import type { UploadedFile } from "@/lib/http/file-upload";
import { connectionError } from "@/features/connections";
import {
  checkReportFiles,
  ReportFileCheckError,
} from "../utils/check-report-files";

function fileCheckMessage(cause: unknown, aborted: boolean) {
  if (aborted) return "Đã dừng kiểm tra tệp. Bấm gửi lại để tiếp tục.";
  if (cause instanceof ReportFileCheckError) return cause.message;
  return connectionError(cause);
}

export function useReportFileCheck({
  read,
  update,
  isCurrent,
  enabled = true,
}: {
  read: (
    id: string,
    signal: AbortSignal,
  ) => Promise<{ fileId: string; state: string }>;
  update: (file: UploadedFile) => void;
  isCurrent: () => boolean;
  enabled?: boolean;
}) {
  const controller = useRef<AbortController | null>(null);
  const focused = useRef(false),
    mounted = useRef(true);
  const current = useRef({ read, update, isCurrent, enabled });
  current.current = { read, update, isCurrent, enabled };
  const [checking, setChecking] = useState(false),
    [error, setError] = useState<string>();
  const active = () =>
    mounted.current &&
    focused.current &&
    current.current.enabled &&
    current.current.isCurrent() &&
    AppState.currentState === "active";
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        controller.current?.abort();
      };
    }, []),
  );
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") controller.current?.abort();
    });
    return () => {
      mounted.current = false;
      controller.current?.abort();
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!enabled) controller.current?.abort();
  }, [enabled]);
  async function check(files: readonly UploadedFile[]) {
    if (!active() || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setError(undefined);
    setChecking(files.length > 0);
    try {
      return await checkReportFiles(files, {
        signal: request.signal,
        active,
        read: (id, signal) => current.current.read(id, signal),
        update: (file) => {
          if (active()) current.current.update(file);
        },
      });
    } catch (cause) {
      if (mounted.current && current.current.isCurrent())
        setError(fileCheckMessage(cause, request.signal.aborted));
    } finally {
      if (controller.current === request) controller.current = null;
      if (mounted.current && current.current.isCurrent()) setChecking(false);
    }
  }
  return {
    check,
    checking,
    error,
    active,
    clearError: () => setError(undefined),
  };
}
