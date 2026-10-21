import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useConnections,
  useConnectionCommand,
  useConnectionQuery,
} from "@/features/connections";
import { useMessagesApi } from "./use-messages-api";
import type { MessageDraft } from "../api/messages-api";

export function useMessageSend(id: string) {
  const api = useMessagesApi(),
    runtime = useConnections(),
    cache = useQueryClient();
  const command = useConnectionCommand();
  const draft = useRef<MessageDraft | undefined>(undefined);
  const [receipt, setReceipt] = useState<string>();
  const refreshPreview = () => {
    void cache.invalidateQueries({
      queryKey: [...runtime.key, "conversations", "preview", id],
    });
  };
  const delivery = useConnectionQuery(
    ["delivery", id, receipt],
    () => api.delivery(id, receipt!),
    !!receipt,
  );
  useEffect(() => {
    if (delivery.data?.deliveryStatus === "DELIVERED" && runtime.isCurrent()) {
      draft.current = undefined;
      setReceipt(undefined);
      void cache.invalidateQueries({
        queryKey: [...runtime.key, "conversations", "preview", id],
      });
      void cache.invalidateQueries({
        queryKey: [...runtime.key, "thread", id],
      });
    }
  }, [delivery.data, runtime, cache, id]);
  async function send(messageText: string, attachmentFileIds: string[] = []) {
    if (receipt || (!messageText.trim() && !attachmentFileIds.length))
      return false;
    const body = { messageText: messageText.trim(), attachmentFileIds };
    const result = await command.run(
      JSON.stringify({ id, ...body }),
      (clientMessageId) => {
        draft.current = { ...body, clientMessageId };
        return api.send(id, draft.current);
      },
    );
    if (!result || !runtime.isCurrent()) return false;
    if (result.deliveryStatus !== "DELIVERED")
      setReceipt(result.clientMessageId);
    else {
      draft.current = undefined;
      refreshPreview();
    }
    return true;
  }
  async function retryPublication() {
    const body = draft.current;
    if (!body || !receipt) return;
    const result = await command.run(`publication:${id}:${receipt}`, () =>
      api.send(id, body),
    );
    if (result?.deliveryStatus === "DELIVERED" && runtime.isCurrent()) {
      setReceipt(undefined);
      draft.current = undefined;
      refreshPreview();
      void cache.invalidateQueries({
        queryKey: [...runtime.key, "thread", id],
      });
    }
  }
  return {
    send,
    pending: command.pending,
    processing: !!receipt,
    error: command.error,
    delivery,
    retryPublication,
  };
}
