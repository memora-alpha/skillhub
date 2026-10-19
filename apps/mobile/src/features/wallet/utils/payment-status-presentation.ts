import type { PaymentObservationRead } from "../types/payment";
import type { PaymentRead } from "./payment-read-query";
import { paymentModel } from "./payment-related-reads";
import { validPaymentId } from "../schemas/payment-contracts";

export function paymentStatusId(params: Record<string, unknown>): string {
  return validPaymentId(params.id) ? params.id : "";
}
// Presentation only, never a second wire schema or a source of financial truth.
export function paymentStatusPresentation(
  state: PaymentRead,
): PaymentObservationRead {
  return {
    status: state.status,
    stale: state.stale,
    ...(state.issue ? { issue: state.issue } : {}),
    ...(state.data ? { data: paymentModel(state.data) } : {}),
    ...(state.data
      ? {
          recoveryRequired: state.data.recoveryRequired,
          recoveryReason: state.data.recoveryReason,
        }
      : {}),
  };
}
