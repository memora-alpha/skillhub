import { AppError } from "@/lib/http/errors";
import type { createMessagesApi, Delivery } from "../api/messages-api";
import type { QueuedText } from "./outbox-types";

export type OutboxApi = Pick<
  ReturnType<typeof createMessagesApi>,
  "send" | "delivery"
>;
export async function deliverQueuedText(
  api: OutboxApi,
  entry: QueuedText,
  signal: AbortSignal,
): Promise<Delivery> {
  if (entry.phase === "check") {
    try {
      const result = await api.delivery(
        entry.conversationId,
        entry.clientMessageId,
        signal,
      );
      if (
        result.deliveryStatus === "DELIVERED" ||
        (result.deliveryStatus === "PENDING" && !result.failureCode)
      )
        return result;
      // PREPARING or publication failure: resume the same immutable command.
    } catch (error) {
      if (!(error instanceof AppError && error.status === 404)) throw error;
    }
  }
  return api.send(
    entry.conversationId,
    {
      clientMessageId: entry.clientMessageId,
      messageText: entry.messageText,
      attachmentFileIds: [],
    },
    signal,
  );
}
export function retryableSend(error: unknown) {
  return (
    error instanceof AppError &&
    (error.kind === "network" ||
      error.status === 408 ||
      error.status === 429 ||
      error.status >= 500)
  );
}
