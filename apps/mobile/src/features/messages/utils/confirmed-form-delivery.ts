import { AppError } from "@/lib/http/errors";
import type { createMessagesApi } from "../api/messages-api";

export type FormDelivery = {
  conversationId: string;
  clientMessageId: string;
  messageText: string;
  state: "sending" | "processing" | "failed";
  error?: unknown;
  attempt?: number;
};
type Options = {
  api: Pick<ReturnType<typeof createMessagesApi>, "send" | "delivery">;
  isCurrent: () => boolean;
  read: () => FormDelivery[];
  write: (items: FormDelivery[]) => void;
  refresh: (id: string) => void;
};
// This receipt queue only retries the chat form, never the business confirmation.
export function createFormDelivery(options: Options) {
  const update = (item: FormDelivery | null, id: string) => {
    if (!options.isCurrent()) return;
    const rest = options.read().filter((entry) => entry.clientMessageId !== id);
    options.write(item ? [...rest, item] : rest);
  };
  const result = (
    item: FormDelivery,
    delivered: boolean,
    failure?: string | null,
  ) => {
    if (
      options.read().find((v) => v.clientMessageId === item.clientMessageId)
        ?.attempt !== item.attempt
    )
      return;
    update(
      delivered
        ? null
        : {
            ...item,
            state: failure ? "failed" : "processing",
            error: failure ? new AppError("http", 409, failure) : undefined,
          },
      item.clientMessageId,
    );
    if (delivered && options.isCurrent()) options.refresh(item.conversationId);
  };
  const send = async (item: FormDelivery) => {
    if (!options.isCurrent()) return;
    const current = options
      .read()
      .find((v) => v.clientMessageId === item.clientMessageId);
    if (current?.state === "sending") return;
    if (
      current &&
      (current.messageText !== item.messageText ||
        current.conversationId !== item.conversationId)
    )
      return;
    item = { ...item, attempt: (current?.attempt ?? 0) + 1 };
    update(
      { ...item, state: "sending", error: undefined },
      item.clientMessageId,
    );
    try {
      const receipt = await options.api.send(item.conversationId, {
        clientMessageId: item.clientMessageId,
        messageText: item.messageText,
      });
      result(
        item,
        receipt.deliveryStatus === "DELIVERED",
        receipt.deliveryStatus === "DELIVERED"
          ? undefined
          : receipt.failureCode,
      );
    } catch (error) {
      if (
        options.read().find((v) => v.clientMessageId === item.clientMessageId)
          ?.attempt === item.attempt
      )
        update({ ...item, state: "failed", error }, item.clientMessageId);
    }
  };
  return {
    publish(
      conversationId: string,
      messageText: string,
      clientMessageId: string,
    ) {
      const current = options
        .read()
        .find((v) => v.clientMessageId === clientMessageId);
      if (current?.state === "processing") return Promise.resolve();
      return send({
        conversationId,
        messageText,
        clientMessageId,
        state: "sending",
      });
    },
    retry: send,
    async check(item: FormDelivery) {
      if (!options.isCurrent()) return;
      const current = options
        .read()
        .find((v) => v.clientMessageId === item.clientMessageId);
      if (!current || current.state === "sending") return;
      item = { ...current, attempt: (current.attempt ?? 0) + 1 };
      update(item, item.clientMessageId);
      try {
        const receipt = await options.api.delivery(
          item.conversationId,
          item.clientMessageId,
        );
        result(
          item,
          receipt.deliveryStatus === "DELIVERED",
          receipt.deliveryStatus === "DELIVERED"
            ? undefined
            : receipt.failureCode,
        );
      } catch (error) {
        if (
          options.read().find((v) => v.clientMessageId === item.clientMessageId)
            ?.attempt === item.attempt
        )
          update({ ...item, state: "failed", error }, item.clientMessageId);
      }
    },
  };
}
