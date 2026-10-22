import type { PaymentCreateSnapshot } from "./payment-create-state";
import { paymentQrFromObservation } from "./payment-qr-model";

export function createPaymentUi(state: PaymentCreateSnapshot) {
  const observation = state.observation;
  return {
    canConfirm: state.stage === "review" && !state.busy,
    canEdit: ["draft", "review"].includes(state.stage) && !state.busy,
    quoteLabel: state.payment
      ? "Credit được máy chủ xác nhận"
      : "Credit ước tính",
    qr:
      observation && !state.cancelUnconfirmed
        ? paymentQrFromObservation(observation, observation.target.scope)
        : { stage: "unavailable" as const },
  };
}
