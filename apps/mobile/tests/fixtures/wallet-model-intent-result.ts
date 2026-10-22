import type { PaymentIntent, PreparationSnapshot } from "./wallet-model-types";
import type { WalletScope } from "../../src/features/wallet/types/wallet";

export const unknownCreation = Object.freeze({
  stage: "UNKNOWN_OUTCOME" as const,
  error: "Chưa xác định yêu cầu đã được tạo hay chưa. Không tạo lại yêu cầu.",
});
// Local model receipt association ONLY; no HTTP status or proposed wire DTO.
export function resolveModelCreation(
  result: unknown,
  intent: PaymentIntent,
): Pick<PreparationSnapshot, "stage" | "paymentId" | "error"> {
  if (!result || typeof result !== "object") return unknownCreation;
  const receipt = result as Record<string, unknown>;
  const owner = receipt.scope as WalletScope | undefined;
  if (
    receipt.intentId !== intent.localId ||
    owner?.ownerId !== intent.scope.ownerId ||
    owner?.generation !== intent.scope.generation ||
    JSON.stringify(receipt.review) !== JSON.stringify(intent.review)
  )
    return unknownCreation;
  if (
    receipt.kind === "created" &&
    typeof receipt.paymentId === "string" &&
    receipt.paymentId.trim().length
  )
    return { stage: "CREATED_WITH_ID", paymentId: receipt.paymentId };
  if (receipt.kind === "rejected-with-no-creation")
    return {
      stage: "REJECTED_WITH_NO_CREATION",
      error: "Yêu cầu chưa được tạo. Bạn có thể xem lại số tiền.",
    };
  return unknownCreation;
}
