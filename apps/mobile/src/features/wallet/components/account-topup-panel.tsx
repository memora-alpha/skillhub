import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PaymentAction as Button } from "./payment-action";
import { Input } from "@/components/Input";
import { FormNotice } from "@/components/FormNotice";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import { Copy, WalletField } from "./wallet-ui";
import {
  PaymentSurface,
  PaymentMethod,
  paymentSurfaceStyles as surface,
} from "./payment-surface";
import { TopupPresets } from "./topup-presets";
import { formatCredit, formatVnd } from "../utils/amount";
import { validateTopUp } from "../utils/topup-policy";
import type { PaymentCoordinator } from "../utils/payment-create-coordinator";
import type { PaymentCreateSnapshot } from "../utils/payment-create-state";

export function AccountTopupPanel({
  model,
  state,
  active,
  onConfirm,
  onReplay,
}: {
  model: PaymentCoordinator;
  state: PaymentCreateSnapshot;
  active: boolean;
  onConfirm?: () => void;
  onReplay?: () => void;
}) {
  const [help, setHelp] = useState(false);
  let estimate: string | undefined;
  try {
    estimate = formatCredit(validateTopUp(state.draft).estimatedCredit);
  } catch {
    /* Incomplete input. */
  }
  const editable = active && !state.busy;
  return (
    <PaymentSurface
      testID="wallet-topup-form"
      title={
        state.stage === "review"
          ? "Xác nhận nạp Credit"
          : state.stage === "known"
            ? "Yêu cầu nạp của bạn"
            : "Nạp Credit"
      }
    >
      {state.stage === "draft" && (
        <>
          <Input
            label="Số tiền nạp"
            placeholder="Ví dụ: 100000"
            value={state.draft}
            onChangeText={model.edit}
            editable={editable}
            inputMode="numeric"
            keyboardType="number-pad"
            hint="1.000–2.000.000 VND · Bước 1.000 VND"
            style={styles.amount}
          />
          <TopupPresets
            value={state.draft}
            disabled={!editable}
            onSelect={model.edit}
          />
          <WalletField label="Credit ước tính" value={estimate ?? "—"} />
          {state.notice && (
            <FormNotice tone="info">
              Nhập số tiền từ 1.000 đến 2.000.000 VND, theo bước 1.000 VND.
            </FormNotice>
          )}
          <Button
            variant="craft"
            disabled={!editable}
            onPress={() => {
              void model.review();
            }}
          >
            Tiếp tục
          </Button>
        </>
      )}
      {state.stage === "review" && state.review && (
        <>
          <View style={surface.hero}>
            <Text style={surface.caption}>BẠN THANH TOÁN</Text>
            <Text style={surface.amount}>
              {formatVnd(state.review.amountVnd)}
            </Text>
            <Text style={surface.credit}>
              {formatCredit(state.review.estimatedCredit)} ước tính
            </Text>
          </View>
          <View style={surface.divider} />
          <PaymentMethod />
          <Text style={surface.caption}>1 Credit = 1.000 VND</Text>
          <Button
            variant="craft"
            icon="arrow"
            disabled={!editable}
            onPress={() => {
              if (onConfirm) onConfirm();
              else void model.confirm();
            }}
          >
            Xác nhận và tạo mã QR
          </Button>
          <Button variant="ghost" disabled={!editable} onPress={model.back}>
            Đổi số tiền
          </Button>
        </>
      )}
      {state.stage === "known" && state.payment && (
        <>
          <WalletField
            label="Số tiền nạp"
            value={formatVnd(state.payment.paymentAmountVnd)}
          />
          <WalletField
            label="Credit"
            value={formatCredit(state.payment.creditAmount)}
          />
          {state.notice && (
            <Copy muted>
              Một số thông tin chưa cập nhật xong. Tiếp tục yêu cầu hiện tại để
              kiểm tra.
            </Copy>
          )}
        </>
      )}
      {state.stage === "unknown" && (
        <>
          <Copy>
            Chưa nhận được kết quả. Tiếp tục yêu cầu hiện tại để tránh nạp
            trùng.
          </Copy>
          {state.canReplay && (
            <Button
              variant="craft"
              disabled={!editable}
              onPress={() => {
                if (onReplay) onReplay();
                else void model.replay();
              }}
            >
              Tiếp tục thanh toán
            </Button>
          )}
        </>
      )}
      {state.stage === "blocked" && (
        <>
          <Copy>
            Hiện chưa thể tiếp tục. Bạn có thể quay lại ví và mở lại thanh toán
            sau.
          </Copy>
          {state.canReturnToDraft && (
            <Button variant="ghost" disabled={!editable} onPress={model.back}>
              Đổi số tiền
            </Button>
          )}
        </>
      )}
      {state.busy && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Copy muted>Đang xử lý…</Copy>
        </View>
      )}
      <Button variant="ghost" onPress={() => setHelp((value) => !value)}>
        {help ? "Đóng trợ giúp" : "Cần trợ giúp?"}
      </Button>
      {help && (
        <>
          <Copy muted>
            Nếu không tìm thấy yêu cầu cũ, hãy liên hệ hỗ trợ để kiểm tra trước
            khi nạp lại.
          </Copy>
          <Button
            variant="paper"
            disabled={!editable}
            onPress={model.supportStop}
          >
            Tôi không tìm thấy yêu cầu cũ
          </Button>
        </>
      )}
    </PaymentSurface>
  );
}
const styles = StyleSheet.create({
  amount: {
    fontFamily: fonts.bold,
    ...typography.title,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  loading: { alignItems: "center", gap: 8 },
});
