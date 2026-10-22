import { AppError } from "@/lib/http/errors";
import type { PaymentIdentity } from "../utils/payment-recovery-record";
import type { CorrelationStore } from "./correlation-store-core";

// Unsupported platforms never fall back to RAM, browser storage or auth storage.
export const openPaymentStore: (
  identity: PaymentIdentity,
  current: () => boolean,
) => Promise<CorrelationStore> = () => Promise.reject(new AppError("storage"));
