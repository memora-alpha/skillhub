import { useSyncExternalStore } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Copy, Panel, WalletField } from "./wallet-ui";
import type { PaymentCoordinator } from "../utils/payment-create-coordinator";
import { createPaymentUi } from "../utils/payment-create-ui";
import { formatCredit, formatVnd } from "../utils/amount";
import { validateTopUp } from "../utils/topup-policy";
import { TopupPresets } from "./topup-presets";
import { AccountTopupPanel } from "./account-topup-panel";

export function PaymentCreatePanel({
  model,
  active,
  synthetic = false,
  mode = "qa",
  onConfirm,
  onReplay,
  stickyAction = false,
  showStatusCheck = true,
}: {
  model: PaymentCoordinator;
  active: boolean;
  synthetic?: boolean;
  mode?: "qa" | "account";
  onConfirm?: () => void;
  onReplay?: () => void;
  stickyAction?: boolean;
  showStatusCheck?: boolean;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const view = createPaymentUi(state);
  let estimate: string | undefined;
  try {
    estimate = formatCredit(validateTopUp(state.draft).estimatedCredit);
  } catch {
    /* Incomplete input has no estimate. */
  }
  if (mode === "account" && !synthetic)
    return (
      <AccountTopupPanel
        model={model}
        state={state}
        active={active}
        onConfirm={onConfirm}
        onReplay={onReplay}
        stickyAction={stickyAction}
        showStatusCheck={showStatusCheck}
      />
    );
  return (
    <Panel
      title={
        synthetic
          ? "Nạp Credit · mẫu"
          : mode === "account"
            ? "Nạp Credit"
            : "Nạp Credit · QA"
      }
    >
      <Copy muted>
        {synthetic
          ? "Mô phỏng độc lập, không gửi yêu cầu tài chính hoặc ghi storage thật."
          : mode === "account"
            ? "Chọn số tiền nạp, xác nhận thông tin và quét mã QR bằng ứng dụng ngân hàng trên thiết bị khác."
            : "Chỉ dùng trong phiên QA được cấp quyền. Thanh toán qua payOS bằng thiết bị thứ hai."}
      </Copy>
      {state.stage === "draft" && (
        <>
          <Input
            label="Số tiền nạp (VND)"
            value={state.draft}
            onChangeText={model.edit}
            editable={active && view.canEdit}
            inputMode="numeric"
            keyboardType="number-pad"
            hint="2.000–2.000.000 VND · Bước 1.000 VND"
          />
          <TopupPresets
            value={state.draft}
            disabled={!active || !view.canEdit}
            onSelect={model.edit}
          />
          <WalletField
            label="Credit ước tính"
            value={estimate ?? "Chưa có số tiền hợp lệ"}
          />
          <Button
            variant="craft"
            disabled={!active || state.busy}
            onPress={() => {
              void model.review();
            }}
          >
            Tiếp tục
          </Button>
        </>
      )}
      {state.stage === "review" && (
        <>
          <WalletField
            label="Số tiền nạp"
            value={formatVnd(state.review!.amountVnd)}
          />
          <WalletField
            label="Credit ước tính"
            value={formatCredit(state.review!.estimatedCredit)}
          />
          <Copy muted>
            Máy chủ xác nhận báo giá khi tạo yêu cầu; chưa cộng Credit vào ví.
          </Copy>
          <Button
            variant="craft"
            disabled={!active || !view.canConfirm}
            onPress={() => {
              if (onConfirm) onConfirm();
              else void model.confirm();
            }}
          >
            {synthetic
              ? "Xác nhận mẫu · không thanh toán"
              : "Xác nhận nạp Credit"}
          </Button>
          <Button variant="ghost" disabled={state.busy} onPress={model.back}>
            Thay đổi số tiền
          </Button>
        </>
      )}
      {state.busy && <FormNotice tone="info">Đang xử lý yêu cầu…</FormNotice>}
      {state.notice && <FormNotice tone="info">{state.notice}</FormNotice>}
      {state.canRestore && (
        <Button
          variant="paper"
          disabled={!active || state.busy}
          onPress={() => {
            void model.bootstrap();
          }}
        >
          Thử khôi phục yêu cầu đã lưu
        </Button>
      )}
      {state.stage === "unknown" && state.canReplay && (
        <Button
          variant="paper"
          disabled={!active || state.busy}
          onPress={() => {
            if (onReplay) onReplay();
            else void model.replay();
          }}
        >
          Khôi phục cùng yêu cầu
        </Button>
      )}
      {state.stage === "blocked" && (
        <Button
          variant="paper"
          disabled={!active || state.busy}
          onPress={() => {
            void model.check();
          }}
        >
          Kiểm tra yêu cầu đang mở
        </Button>
      )}
      {state.stage === "blocked" && state.canReturnToDraft && (
        <Button variant="ghost" disabled={state.busy} onPress={model.back}>
          Quay lại số tiền
        </Button>
      )}
      {state.payment && (
        <>
          <WalletField
            label="Số tiền được xác nhận"
            value={formatVnd(state.payment.paymentAmountVnd)}
          />
          <WalletField
            label={view.quoteLabel}
            value={formatCredit(state.payment.creditAmount)}
          />
          {state.payment.expiresAt && (
            <WalletField
              label="Thời hạn do máy chủ cấp"
              value={state.payment.expiresAt}
            />
          )}
        </>
      )}
    </Panel>
  );
}
