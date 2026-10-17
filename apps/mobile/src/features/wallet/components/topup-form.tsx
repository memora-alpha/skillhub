import { useSyncExternalStore } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Copy, Panel } from "@/components/feature-page";
import { amountHint, validateTopUp } from "../utils/topup-policy";
import { formatCredit, formatVnd } from "../utils/amount";
import type { PaymentPreparation } from "../utils/payment-intent";
import type { ModelDispatch } from "../types/payment";

const schema = z.object({
  amountText: z.string().refine((text) => {
    try {
      validateTopUp(text);
      return true;
    } catch {
      return false;
    }
  }, amountHint),
});
export function TopupForm({
  model,
  previewDispatch,
}: {
  model: PaymentPreparation;
  previewDispatch?: ModelDispatch;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const form = useForm({
    defaultValues: { amountText: state.draft.amountText },
    resolver: zodResolver(schema),
  });
  const review = state.review;
  const editable = state.stage === "DRAFT" || state.stage === "REVIEW";
  return (
    <Panel title={review ? "Xem lại yêu cầu nạp" : "Số tiền nạp"}>
      <Copy>Phương thức: payOS · Tỷ lệ: 1.000 VND / 1 Credit.</Copy>
      {!review && (
        <Controller
          control={form.control}
          name="amountText"
          render={({ field, fieldState }) => (
            <Input
              ref={field.ref}
              label="Số tiền nạp (VND)"
              value={field.value}
              onChangeText={(text) => {
                field.onChange(text);
                model.edit(text);
              }}
              onBlur={field.onBlur}
              editable={editable}
              keyboardType="number-pad"
              inputMode="numeric"
              autoCorrect={false}
              hint={amountHint}
              error={fieldState.error?.message ?? state.error}
            />
          )}
        />
      )}
      {review && (
        <>
          <Copy>Số tiền: {formatVnd(review.amountVnd)}</Copy>
          <Copy>Credit ước tính: {formatCredit(review.estimatedCredit)}</Copy>
          <Copy muted>
            {review.provenance === "confirmed-model"
              ? "Thông tin xác nhận minh họa; không phải báo giá cho tài khoản thật."
              : "Chưa có báo giá được máy chủ xác nhận. Credit ước tính chưa được cộng vào ví."}
          </Copy>
          {review.quote && (
            <Copy>Thời hạn xác nhận mẫu: {review.quote.expiresAt}</Copy>
          )}
        </>
      )}
      {state.stage === "DRAFT" && (
        <Button
          variant="craft"
          onPress={() => {
            void form.handleSubmit(
              () => model.review(),
              () => model.review(),
            )();
          }}
        >
          Xem lại số tiền
        </Button>
      )}
      {state.stage === "REVIEW" && (
        <Button variant="paper" onPress={model.backToDraft}>
          Sửa số tiền
        </Button>
      )}
      <Button
        variant="craft"
        disabled={!previewDispatch || state.stage !== "REVIEW"}
        onPress={() => {
          if (previewDispatch) void model.confirmModel(previewDispatch);
        }}
      >
        {previewDispatch
          ? "Xác nhận mẫu · không thanh toán"
          : "Xác nhận nạp · chưa sẵn sàng"}
      </Button>
      {state.stage === "CREATING" && (
        <FormNotice tone="info">Đang xử lý yêu cầu minh họa…</FormNotice>
      )}
      {state.stage === "UNKNOWN_OUTCOME" && (
        <FormNotice tone="error">
          Chưa xác định yêu cầu đã được tạo hay chưa. Không tạo lại yêu cầu; bạn
          có thể quay về ví.
        </FormNotice>
      )}
      {state.stage === "REJECTED_WITH_NO_CREATION" && (
        <>
          <FormNotice tone="error">
            Yêu cầu mẫu chưa được tạo. Số tiền đã nhập được giữ lại.
          </FormNotice>
          <Button variant="paper" onPress={model.startNext}>
            Sửa yêu cầu mẫu
          </Button>
        </>
      )}
      {state.stage === "CREATED_WITH_ID" && (
        <Copy>Đã tạo yêu cầu mẫu. Chưa xác nhận thanh toán.</Copy>
      )}
      {state.stage === "SESSION_ENDED" && (
        <FormNotice tone="info">
          Phiên đã kết thúc. Vui lòng đăng nhập lại.
        </FormNotice>
      )}
      {!previewDispatch && (
        <FormNotice tone="info">
          Nạp Credit hiện chưa sẵn sàng. Bạn có thể nhập và xem lại số tiền;
          chưa có yêu cầu thanh toán nào được gửi.
        </FormNotice>
      )}
    </Panel>
  );
}
