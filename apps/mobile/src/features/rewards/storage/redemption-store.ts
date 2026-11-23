import { AppError } from "@/lib/http/errors";
import type { RedemptionIntent } from "../api/reward-contracts";
export type RedemptionStore = {
  read: () => Promise<RedemptionIntent | null>;
  write: (intent: RedemptionIntent) => Promise<void>;
  remove: (expectedKey: string) => Promise<void>;
};
// Non-native previews can browse, but must not send a debit without durable recovery.
export const openRedemptionStore: (
  ownerId: string,
  environment: string,
) => Promise<RedemptionStore> = async () => {
  throw new AppError("storage");
};
