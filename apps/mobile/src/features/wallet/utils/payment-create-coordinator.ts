import { AppError } from "@/lib/http/errors";
import { validateTopUp } from "./topup-policy";
import { createPaymentCreateRuntime } from "./payment-create-runtime";
import { createPaymentAccept } from "./payment-create-observe";
import { createPaymentDispatch } from "./payment-create-dispatch";
import type { PaymentCoordinatorOptions } from "./payment-create-state";
export function createPaymentCoordinator(input: PaymentCoordinatorOptions) {
  const session = createPaymentCreateRuntime(input);
  const { options, state, current, publish, run, policy } = session;
  const accept = createPaymentAccept(session);
  return {
    getSnapshot: session.snapshot,
    subscribe: session.subscribe,
    ...createPaymentDispatch(session, accept),
    pause: session.pause,
    dispose: session.dispose,
    activate: session.activate,
    bootstrap: () =>
      run(async (signal, valid) => {
        if (state.incident) {
          publish({
            stage: "blocked",
            notice: "Định danh đã mất hoặc có sự cố khôi phục. Liên hệ hỗ trợ.",
          });
          return;
        }
        const store = await options.openStore();
        valid();
        state.store = store;
        const record = await store.load();
        valid();
        state.record = record ?? undefined;
        state.storeVerified = true;
        if (!state.record) {
          publish({ stage: "draft" });
          return;
        }
        publish({
          draft: state.record.body.paymentAmountVnd,
          paymentId: state.record.paymentId,
          stage: state.record.paymentId ? "known" : "unknown",
        });
        if (state.record.paymentId) {
          try {
            await accept(
              await options.api.detail(state.record.paymentId, signal),
              valid,
            );
          } catch (error) {
            valid();
            publish({
              stage: "blocked",
              payment: undefined,
              observation: undefined,
              readDenied:
                error instanceof AppError && [403, 404].includes(error.status),
              notice:
                "Chưa thể đọc yêu cầu đã lưu. Liên hệ hỗ trợ; không tạo lại.",
            });
          }
        }
      }),
    edit: (draft: string) => {
      if (
        current() &&
        !session.pending() &&
        !state.record &&
        !state.incident &&
        ["draft", "review"].includes(session.snapshot().stage)
      )
        publish({
          stage: "draft",
          draft,
          review: undefined,
          notice: undefined,
        });
    },
    review: () => {
      if (
        state.record ||
        state.incident ||
        !["draft", "review"].includes(session.snapshot().stage)
      )
        return Promise.resolve();
      return run(async (signal, valid) => {
        let review;
        try {
          review = validateTopUp(session.snapshot().draft);
        } catch {
          publish({
            stage: "draft",
            notice: "Nhập số nguyên từ 1.000 đến 2.000.000 VND, bước 1.000.",
          });
          return;
        }
        const value = await policy(signal, valid);
        publish(
          value.canCreate
            ? { stage: "review", review, notice: undefined }
            : {
                stage: "blocked",
                notice:
                  "Hiện chưa thể tạo yêu cầu nạp. Kiểm tra yêu cầu đang mở hoặc liên hệ hỗ trợ.",
              },
        );
      });
    },
    back: () => {
      if (
        current() &&
        !session.pending() &&
        !state.record &&
        !state.incident &&
        state.storeVerified &&
        ["review", "blocked"].includes(session.snapshot().stage)
      )
        publish({ stage: "draft", review: undefined });
    },
    check: () =>
      run(async (signal, valid) => {
        const id =
          session.snapshot().paymentId ??
          (!state.record
            ? session.snapshot().policy?.existingPaymentId
            : undefined);
        if (!id) {
          await policy(signal, valid);
          return;
        }
        try {
          await accept(await options.api.detail(id, signal), valid);
        } catch (error) {
          valid();
          const observation = session.snapshot().observation;
          if (error instanceof AppError && [403, 404].includes(error.status))
            publish({
              stage: "blocked",
              payment: undefined,
              observation: undefined,
              readDenied: true,
              notice:
                "Không thể truy cập yêu cầu. Giữ định danh và liên hệ hỗ trợ.",
            });
          else
            publish({
              notice: "Chưa cập nhật được. Kết quả trước đó được giữ lại.",
              observation: observation
                ? { ...observation, stale: true }
                : undefined,
            });
        }
      }),
    startNext: () => {
      if (current() && session.snapshot().canStartNext)
        publish({
          stage: "draft",
          review: undefined,
          payment: undefined,
          paymentId: undefined,
          observation: undefined,
          notice: undefined,
        });
    },

    supportStop: () => {
      if (!current()) return;
      state.incident = true;
      session.pause();
      publish({
        stage: "blocked",
        notice:
          "Đã mất định danh hoặc có sự cố khôi phục. Liên hệ hỗ trợ; không tạo lại.",
      });
    },
  };
}
export type PaymentCoordinator = ReturnType<typeof createPaymentCoordinator>;
