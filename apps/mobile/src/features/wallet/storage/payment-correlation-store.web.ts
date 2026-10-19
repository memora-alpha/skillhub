import { AppError } from "@/lib/http/errors";
import type { PaymentIdentity } from "../utils/payment-recovery-record";
import type { CorrelationStore } from "./correlation-store-core";
export async function openPaymentStore(
  _identity: PaymentIdentity,
  _current: () => boolean,
): Promise<CorrelationStore> {
  void _identity;
  void _current;
  throw new AppError("storage");
}
