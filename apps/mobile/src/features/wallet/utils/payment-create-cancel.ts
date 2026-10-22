import { AppError } from "@/lib/http/errors";
import { detachPaymentQr } from "./payment-observation";
import { isTerminalPaymentStatus } from "./payment-outcome";
import type { PaymentCreateRuntime } from "./payment-create-runtime";
import type { PaymentCreateSnapshot } from "./payment-create-state";

const pendingPayment = (snapshot: PaymentCreateSnapshot) =>
  !snapshot.readDenied &&
  snapshot.stage === "known" &&
  snapshot.payment?.gateway === "PAYOS" &&
  ["CREATED", "PENDING"].includes(snapshot.payment.status);

function cancelNotice(error: unknown) {
  if (error instanceof AppError) {
    if (error.code === "PAYMENT_CHECKOUT_BUSY")
      return "Thanh toán đang được xử lý. Bạn có thể thử hủy lại sau.";
    if (error.code === "PAYMENT_REVIEW_REQUIRED")
      return "Thanh toán đang được kiểm tra nên chưa thể hủy. Vui lòng quay lại sau.";
    if (error.code === "PAYMENT_ALREADY_PAID")
      return "Chưa thể hủy. Ứng dụng đang cập nhật kết quả thanh toán.";
  }
  return "Chưa xác nhận được việc hủy thanh toán. Bạn có thể thử hủy lại sau.";
}

export function createPaymentCancellation(
  session: PaymentCreateRuntime,
  accept: (raw: unknown, valid: () => void) => Promise<void>,
) {
  const { options, publish, run, state } = session;
  const deny = (error: unknown) => {
    if (!(error instanceof AppError) || ![403, 404].includes(error.status))
      return false;
    publish({
      stage: "blocked",
      payment: undefined,
      observation: undefined,
      readDenied: true,
      cancelNotice: "Không thể mở thanh toán này. Vui lòng quay lại ví.",
    });
    return true;
  };
  async function refreshBeforeCancel(
    id: string,
    signal: AbortSignal,
    valid: () => void,
  ) {
    try {
      await accept(await options.api.detail(id, signal), valid);
      valid();
    } catch (error) {
      valid();
      if (!deny(error))
        publish({
          cancelNotice:
            "Chưa thể cập nhật thanh toán. Vui lòng thử hủy lại sau.",
        });
      return false;
    }
    const fresh = session.snapshot();
    if (pendingPayment(fresh) && !fresh.observation?.stale) return true;
    if (fresh.payment?.status === "REVIEW")
      publish({
        cancelNotice: cancelNotice(
          new AppError("http", 409, "PAYMENT_REVIEW_REQUIRED"),
        ),
      });
    else if (fresh.observation?.stale)
      publish({
        cancelNotice:
          "Thông tin thanh toán chưa được xác nhận. Vui lòng thử lại sau.",
      });
    return false;
  }
  return () => {
    const snapshot = session.snapshot();
    const needsFreshRead = !snapshot.canCancel && !!snapshot.observation?.stale;
    if (
      !pendingPayment(snapshot) ||
      !snapshot.paymentId ||
      !options.api.cancel ||
      state.incident ||
      (snapshot.busy && !snapshot.checking) ||
      (!snapshot.canCancel && !needsFreshRead)
    )
      return Promise.resolve();
    const id = snapshot.paymentId;
    // Owner + payment:cancel + UUID permanently identify this command on BE.
    // Stable across restart without storing another raw financial key/schema.
    const key = `payment-cancel:${id}`;
    return run(async (signal, valid) => {
      if (needsFreshRead && !(await refreshBeforeCancel(id, signal, valid)))
        return;
      valid();
      const current = session.snapshot();
      const observation = current.observation
        ? detachPaymentQr(current.observation)
        : undefined;
      publish({
        cancelUnconfirmed: true,
        cancelNotice: undefined,
        observation,
        payment: observation?.data,
      });
      let failure: unknown;
      try {
        const result = await options.api.cancel!(id, key, signal);
        valid();
        await accept(result, valid);
      } catch (error) {
        valid();
        if (deny(error)) return;
        failure = error;
        // A lost response/409 is not cancellation proof. Hydrate live state;
        // PAID still goes through the ordinary related-read path, never refund.
        try {
          await accept(await options.api.detail(id, signal), valid);
        } catch (readError) {
          valid();
          if (deny(readError)) return;
        }
      }
      valid();
      const latest = session.snapshot();
      if (
        latest.payment &&
        !latest.observation?.stale &&
        isTerminalPaymentStatus(latest.payment.status)
      )
        return;
      publish({
        cancelNotice: cancelNotice(
          latest.payment?.status === "REVIEW"
            ? new AppError("http", 409, "PAYMENT_REVIEW_REQUIRED")
            : failure,
        ),
      });
    }, "cancel");
  };
}
