import { parsePayment } from "../schemas/payment-contracts";
import { correlationResolved } from "./payment-recovery-record";
import { isTerminalPaymentStatus } from "./payment-outcome";
import {
  createPaymentObservation,
  reducePaymentObservation,
} from "./payment-observation";
import type { PaymentCreateRuntime } from "./payment-create-runtime";

export function createPaymentAccept(session: PaymentCreateRuntime) {
  const { state, options, publish } = session;
  return async (raw: unknown, valid: () => void) => {
    valid();
    const snapshot = session.snapshot(),
      payment = parsePayment(raw, snapshot.paymentId);
    if (
      state.record &&
      (payment.paymentAmountVnd !== state.record.body.paymentAmountVnd ||
        payment.gateway !== state.record.body.gateway)
    ) {
      publish({
        stage: "blocked",
        paymentId: payment.id,
        payment: undefined,
        observation: undefined,
        notice: "Thông tin số tiền chưa khớp. Vui lòng kiểm tra lại yêu cầu.",
      });
      return;
    }
    const observation = reducePaymentObservation(
      snapshot.observation ??
        createPaymentObservation({
          scope: options.scope,
          paymentId: payment.id,
        }),
      {
        scope: options.scope,
        paymentId: payment.id,
        ticket: session.ticket(),
        currentTicket: session.ticket(),
        data: payment,
      },
    );
    publish({
      stage: "known",
      paymentId: payment.id,
      payment: observation.data,
      observation,
      readDenied: false,
      ...(observation.data &&
      !observation.stale &&
      isTerminalPaymentStatus(observation.data.status)
        ? { cancelUnconfirmed: false, cancelNotice: undefined }
        : {}),
      notice: observation.stale
        ? "Thông tin trước đó cần được kiểm tra lại."
        : state.record && !state.storeVerified
          ? "Chưa lưu được mã yêu cầu. Chỉ kiểm tra trạng thái; không tạo lại."
          : undefined,
    });
    if (
      state.record &&
      state.storeVerified &&
      !observation.stale &&
      observation.data &&
      correlationResolved(state.record, observation.data)
    ) {
      try {
        await state.store!.resolve(observation.data);
        valid();
        state.record = undefined;
      } catch {
        valid();
        publish({
          notice:
            "Thanh toán giữ nguyên kết quả; cleanup chưa hoàn tất. Chưa thể tạo yêu cầu mới.",
        });
      }
    }
  };
}
