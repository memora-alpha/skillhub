import type { Payment, PaymentPolicy } from "./account-types";
import type { Reply } from "../types";
import type { UserRequestOptions } from "../api/client";
import { UserApiError } from "../api/client";
export type PaymentIntent = { key: string; amount: string };
export function validPaymentAmount(value: string) {
  return (
    /^\d+$/.test(value) &&
    Number(value) >= 1000 &&
    Number(value) <= 2_000_000 &&
    Number(value) % 1000 === 0
  );
}
export function paymentPolicyText(code: string | null) {
  const reasons: Record<string, string> = {
    PAYMENT_UNRESOLVED:
      "Bạn có đơn nạp đang chờ xác nhận. Mở đơn hiện tại để tiếp tục.",
    PAYMENT_RECONCILIATION_REQUIRED:
      "Đơn trước đang được kiểm tra nên chưa thể tạo đơn mới. Mở đơn hiện tại hoặc liên hệ hỗ trợ.",
    PAYMENT_CHANNEL_RECONCILIATION_REQUIRED:
      "Hệ thống đang kiểm tra các đơn cũ. Vui lòng chờ và không chuyển thêm tiền vào mã QR cũ.",
    PAYMENT_CREATION_PAUSED:
      "Dịch vụ nạp Credit đang tạm dừng tạo đơn mới. Bạn vẫn có thể kiểm tra các đơn đã tạo.",
    PAYMENT_PROVIDER_UNAVAILABLE:
      "Nhà cung cấp thanh toán chưa sẵn sàng. Thử kiểm tra lại sau.",
  };
  return code && reasons[code]
    ? reasons[code]
    : "Chưa thể tạo lệnh nạp. Kiểm tra trạng thái kênh và các lệnh hiện tại.";
}
type Request = <T>(
  path: string,
  options?: UserRequestOptions,
) => Promise<Reply<T>>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function paymentReceipt(value: Payment) {
  if (!value || !uuid.test(value.id) || typeof value.status !== "string")
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  return value;
}
export async function recoverOrCreatePayment(
  request: Request,
  intent: PaymentIntent,
  isRecovery = true,
) {
  if (!validPaymentAmount(intent.amount))
    throw new UserApiError(400, "INVALID_PAYMENT_AMOUNT");
  const policy = (await request<PaymentPolicy>("payments/creation-policy"))
    .data;
  if (
    !policy ||
    typeof policy.canCreate !== "boolean" ||
    !(
      policy.existingPaymentId === null ||
      (typeof policy.existingPaymentId === "string" &&
        uuid.test(policy.existingPaymentId))
    )
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  // An unresolved order wins over creating another intent, including after reload.
  if (policy.existingPaymentId)
    return paymentReceipt(
      (await request<Payment>("payments/" + policy.existingPaymentId)).data,
    );
  if (!isRecovery && !policy.canCreate)
    throw new UserApiError(
      409,
      policy.reasonCode ?? "PAYMENT_PROVIDER_UNAVAILABLE",
    );
  // Replay the saved key even when creation is paused: BE decides whether this
  // is an existing receipt or a fresh request blocked by the current policy.
  return paymentReceipt(
    (
      await request<Payment>("payments", {
        method: "POST",
        key: intent.key,
        body: { paymentAmountVnd: intent.amount, gateway: "PAYOS" },
      })
    ).data,
  );
}
