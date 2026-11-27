import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { useNetworkState } from "expo-network";
import { useQueryClient } from "@tanstack/react-query";
import { useConnectionQuery, useConnections } from "@/features/connections";
import { deviceOffline } from "@/lib/network/connection-store";
import { useMessagesApi } from "./use-messages-api";
import type { ApiMessage } from "../api/messages-api";
import { reloadChatEventQueries } from "../utils/event-hydration";
import { retryChatAttachment } from "../utils/retry-chat-attachment";

export function useAttachmentRecovery(
  message: ApiMessage,
  file: ApiMessage["attachments"][number],
) {
  const runtime = useConnections();
  const api = useMessagesApi();
  const cache = useQueryClient();
  const focused = useIsFocused();
  const offline = deviceOffline(useNetworkState());
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<unknown>();
  const operation = useRef<AbortController | undefined>(undefined);
  const allowed = runtime.enabled && focused && !offline;
  const enabled = allowed && foreground;
  const eligible = useRef(allowed);
  eligible.current = allowed;
  const id = message.conversationId;
  const status = useConnectionQuery(
    ["chat-file", id, file.fileId, "published", message.id, file.attachmentId],
    (signal) =>
      api.publishedAttachmentStatus(id, message.id, file.attachmentId, signal),
    enabled,
    { freshOnMount: true, cancelOnDisable: true },
  );
  const refreshThread = useCallback(
    () =>
      reloadChatEventQueries(
        cache,
        runtime.key,
        [
          ["thread", id],
          ["conversations", "preview", id],
        ],
        undefined,
        runtime.assertCurrent,
        id,
      ),
    [cache, runtime.key, runtime.assertCurrent, id],
  );
  const refreshed = useRef<string | undefined>(undefined);
  const cancelOperation = useCallback(() => {
    operation.current?.abort();
    operation.current = undefined;
  }, []);
  useEffect(() => {
    const row = status.data;
    if (!enabled || !row || status.isError) return;
    const signature = `${row.accessStatus}:${row.moderationStatus}`;
    if (
      row.accessStatus === (file.accessStatus ?? file.availability) &&
      row.moderationStatus === file.moderationStatus
    )
      return;
    if (refreshed.current === signature) return;
    refreshed.current = signature;
    void refreshThread().catch(() => {
      refreshed.current = undefined;
    });
  }, [
    status.data,
    status.isError,
    file.accessStatus,
    file.availability,
    file.moderationStatus,
    enabled,
    refreshThread,
  ]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        cancelOperation();
        setBusy(false);
      }
      setForeground(state === "active");
    });
    return () => listener.remove();
  }, [cancelOperation]);
  useEffect(() => {
    if (!enabled) {
      cancelOperation();
      setBusy(false);
    }
    return cancelOperation;
  }, [
    enabled,
    id,
    message.id,
    file.fileId,
    file.attachmentId,
    runtime.key,
    cancelOperation,
  ]);
  const canRun = () =>
    eligible.current &&
    AppState.currentState === "active" &&
    runtime.isCurrent();
  async function run(checkOnly = false) {
    if (operation.current || !canRun()) return;
    const control = new AbortController();
    operation.current = control;
    const current = () =>
      operation.current === control && !control.signal.aborted && canRun();
    setBusy(true);
    setError(undefined);
    try {
      const read = async () => {
        const result = await status.refetch({ cancelRefetch: false });
        if (result.error) throw result.error;
        if (!result.data) throw new Error("Attachment status unavailable");
        return result.data;
      };
      if (checkOnly || uncertain) await read();
      else
        await retryChatAttachment({
          read,
          retry: () => {
            setUncertain(true);
            return api.retryAttachment(id, file.fileId, control.signal);
          },
          current,
        });
      if (!current()) return;
      setUncertain(false);
      await refreshThread();
    } catch (cause) {
      if (current()) setError(cause);
    } finally {
      if (current()) {
        operation.current = undefined;
        setBusy(false);
      }
    }
  }
  return {
    status: status.data,
    denied: status.denied,
    pending: busy || status.isFetching,
    uncertain,
    error: error ?? status.error,
    disabled: !enabled || busy || status.isFetching,
    retry: () => run(),
    check: () => run(true),
  };
}
