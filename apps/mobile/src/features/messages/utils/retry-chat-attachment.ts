import { AppError } from "@/lib/http/errors";
import type { ChatFileStatus } from "../api/chat-attachment-contracts";
import { canRetryChatAttachment } from "../outbox/attachment-errors";

// A manual tap always re-reads permission. Reconnect and polling only call GET.
export async function retryChatAttachment<
  T extends {
    canRetry?: boolean;
    moderationStatus?: ChatFileStatus["moderationStatus"];
    accessStatus?: ChatFileStatus["accessStatus"];
    availability?: ChatFileStatus["availability"];
  },
>(options: {
  read(): Promise<T>;
  retry(): Promise<ChatFileStatus>;
  current(): boolean;
}) {
  if (!options.current()) throw new AppError("session");
  const status = await options.read();
  if (!options.current()) throw new AppError("session");
  const availability = status.accessStatus ?? status.availability;
  if (availability !== "UNAVAILABLE" || !canRetryChatAttachment(status))
    return status;
  const result = await options.retry();
  if (!options.current()) throw new AppError("session");
  return result;
}
