import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export type NotificationChannelCode = "IN_APP" | "EMAIL" | "PUSH";

/** One event's message for its recipients; title/body never carry private data. */
export type NotificationMessage = {
  eventId: string;
  type: string;
  userIds: string[];
  title: string;
  body: string;
  payload: Record<string, string>;
};

/** In-app inbox delivery; SH-110 owns the notification center behind it. */
export abstract class InAppNotificationPort {
  abstract notify(
    tx: TransactionContext,
    message: NotificationMessage,
  ): Promise<void>;
}

export abstract class TransactionalMailer {
  abstract send(input: {
    to: string;
    subject: string;
    text: string;
    messageId: string;
  }): Promise<void>;
}

export abstract class PushSender {
  abstract readonly configured: boolean;

  /** Tokens the provider reports as no longer registered come back as invalid. */
  abstract send(input: {
    tokens: string[];
    title: string;
    body: string;
    data: Record<string, string>;
  }): Promise<{ invalidTokens: string[] }>;
}
