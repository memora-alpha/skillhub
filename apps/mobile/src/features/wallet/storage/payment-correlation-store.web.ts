import { AppError } from "@/lib/http/errors";
import type { PaymentIdentity } from "../utils/payment-recovery-record";
import type { CorrelationStore } from "./correlation-store-core";
export const openPaymentStore: (
  identity: PaymentIdentity,
  current: () => boolean,
) => Promise<CorrelationStore> = () => Promise.reject(new AppError("storage"));
