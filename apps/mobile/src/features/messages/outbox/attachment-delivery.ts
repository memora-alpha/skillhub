import { AppError } from "@/lib/http/errors";
import type { Delivery } from "../api/messages-api";
import type { OutboxApi } from "./outbox-delivery";
import type { QueuedText } from "./outbox-types";

export async function recoverAttachmentDelivery(
  api: OutboxApi,
  entry: QueuedText,
  signal: AbortSignal,
  assertActive: () => void,
) {
  if (entry.phase !== "check") return;
  let result: Delivery;
  try {
    result = await api.delivery(
      entry.conversationId,
      entry.clientMessageId,
      signal,
    );
  } catch (error) {
    if (!(error instanceof AppError && error.status === 404)) throw error;
    assertActive();
    return;
  }
  assertActive();
  if (result.deliveryStatus === "DELIVERED") return result;
  if (result.deliveryStatus === "PREPARING" || result.failureCode) return;
  return result;
}

export async function waitForAttachmentDelivery(
  result: Delivery,
  options: {
    api: OutboxApi;
    entry: QueuedText;
    signal: AbortSignal;
    assertActive(): void;
    sleep(ms: number, signal: AbortSignal): Promise<void>;
    processing(messageId: string): void;
  },
) {
  let delivery = result;
  while (delivery.deliveryStatus !== "DELIVERED") {
    options.assertActive();
    if (delivery.failureCode)
      throw new AppError("http", 409, delivery.failureCode);
    options.processing(delivery.messageId);
    // Both waits are dependent: backoff first, then GET the next publication state.
    await options.sleep(2000, options.signal);
    options.assertActive();
    delivery = await options.api.delivery(
      options.entry.conversationId,
      options.entry.clientMessageId,
      options.signal,
    );
  }
  return delivery.message;
}
