import { parsePayment } from "../schemas/payment-contracts";
import { makeRecoveryRecord } from "./payment-recovery-record";
import type { PaymentCreateRuntime } from "./payment-create-runtime";

export function createPaymentDispatch(
  session: PaymentCreateRuntime,
  accept: (raw: unknown, valid: () => void) => Promise<void>,
) {
  const { state, options, publish, policy, run } = session;
  async function post(signal: AbortSignal, valid: () => void) {
    const record = state.record!;
    publish({ stage: "claiming", notice: undefined });
    try {
      valid();
      const raw = await options.api.create(record.body, record.key, signal);
      valid();
      const payment = parsePayment(raw);
      publish({ paymentId: payment.id });
      let storageNotice: string | undefined;
      try {
        const bound = await state.store!.bindId(record.key, payment.id);
        valid();
        state.record = bound;
      } catch {
        valid();
        state.storeVerified = false;
        storageNotice =
          "Chưa lưu được mã yêu cầu. Chỉ kiểm tra trạng thái; không tạo lại.";
      }
      await accept(payment, valid);
      valid();
      if (storageNotice) publish({ notice: storageNotice });
    } catch {
      valid();
      publish({
        stage: "unknown",
        notice:
          "Chưa rõ yêu cầu đã tạo hay chưa. Giữ nguyên yêu cầu để khôi phục.",
      });
    }
  }
  return {
    confirm: () => {
      if (
        session.snapshot().stage !== "review" ||
        state.record ||
        state.incident ||
        !state.storeVerified
      )
        return Promise.resolve();
      return run(async (signal, valid) => {
        const value = await policy(signal, valid);
        if (!value.canCreate) {
          publish({
            stage: "blocked",
            notice: "Điều kiện tạo yêu cầu đã thay đổi; chưa gửi thanh toán.",
          });
          return;
        }
        const body = Object.freeze({
          paymentAmountVnd: session.snapshot().review!.amountVnd,
          gateway: "PAYOS" as const,
        });
        const key = options.newKey();
        state.record = makeRecoveryRecord({
          ...options.identity,
          key,
          localIntentId: key,
          body,
        });
        state.storeVerified = false;
        publish({ stage: "claiming" });
        const claimed = await state.store!.claim(state.record);
        valid();
        state.record = claimed;
        state.storeVerified = true;
        await post(signal, valid);
      });
    },
    replay: () => {
      if (
        session.snapshot().stage !== "unknown" ||
        !state.record ||
        state.record.paymentId ||
        !state.storeVerified ||
        state.incident
      )
        return Promise.resolve();
      return run(async (signal, valid) => {
        const value = await policy(signal, valid);
        if (
          !value.canCreate &&
          ![
            "PAYMENT_CREATION_PAUSED",
            "PAYMENT_UNRESOLVED",
            "PAYMENT_RECONCILIATION_REQUIRED",
            "PAYMENT_CHANNEL_RECONCILIATION_REQUIRED",
          ].includes(value.reasonCode ?? "")
        ) {
          publish({
            notice:
              "Chưa thể khôi phục qua kênh hiện tại. Không tạo yêu cầu mới.",
          });
          return;
        }
        await post(signal, valid);
      });
    },
  };
}
