import { AppError } from "@/lib/http/errors";
import type { SubscriptionIntent } from "../api/subscription-contracts";
export type SubscriptionStore = {
  read: () => Promise<SubscriptionIntent | null>;
  write: (intent: SubscriptionIntent) => Promise<void>;
  remove: (key: string) => Promise<void>;
};
// Financial commands require durable storage. Web preview can read and manage renewal.
export const openSubscriptionStore: (
  owner: string,
  environment: string,
) => Promise<SubscriptionStore> = async () => {
  throw new AppError("storage", 0, "SUBSCRIPTION_NATIVE_REQUIRED");
};
