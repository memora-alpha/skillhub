import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Copy, Panel, WalletField } from "./wallet-ui";
import { Icon, type IconName } from "@/components/Icon";
import { appRadius, fonts, typography } from "@/constants/theme";
import { FormNotice } from "@/components/FormNotice";
import { FinancialReadState } from "./financial-read-state";
import { formatCredit, formatVnd } from "../utils/amount";
import { paymentOutcome } from "../utils/payment-outcome";
import { SimplePaymentStatus } from "./simple-payment-status";
import type {
  PaymentObservationRead,
  PaymentRefreshSnapshot,
} from "../types/payment";
import { paymentPalette as colors } from "./wallet-payment-palette";

export function PaymentStatusPanel({
  state,
  onCheck,
  refresh,
  onRefresh,
  qrRenderError = false,
  compact = false,
  automatic = false,
  watching = false,
}: {
  state: PaymentObservationRead;
  onCheck?: () => void;
  refresh?: PaymentRefreshSnapshot;
  onRefresh?: (name: "wallet" | "history") => void;
  qrRenderError?: boolean;
  compact?: boolean;
  automatic?: boolean;
  watching?: boolean;
}) {
  if (compact)
    return (
      <SimplePaymentStatus
        automatic={automatic}
        watching={watching}
        state={state}
        onCheck={onCheck}
        refresh={refresh}
        onRefresh={onRefresh}
      />
    );
  const data = state.data;
  const busy = state.status === "loading" || state.status === "refreshing";
  // Fresh confirmed outcomes need no redundant manual refresh action. Pending
  // reads remain explicit: this presentation change does not add a polling policy.
  const canCheck =
    !busy &&
    onCheck &&
    (["error", "refresh-error"].includes(state.status) ||
      (data &&
        (state.stale ||
          ["CREATED", "PENDING", "REVIEW", "UNKNOWN"].includes(data.state))));
  const tone =
    data?.state === "PAID"
      ? "success"
      : ["FAILED", "EXPIRED"].includes(data?.state ?? "")
        ? "error"
        : "neutral";
  const icon: IconName =
    tone === "success" ? "check-circle" : tone === "error" ? "alert" : "clock";
  return (
    <Panel testID="wallet-payment-status" style={styles.panel}>
      <FinancialReadState
        state={state}
        unavailableMessage="Bạn có thể quay lại ví và thử sau."
      >
        {data && (
          <View style={{ gap: 12 }}>
            <View style={styles.summary}>
              <View
                style={[
                  styles.icon,
                  tone === "success" && styles.success,
                  tone === "error" && styles.error,
                ]}
              >
                <Icon
                  name={icon}
                  color={tone === "error" ? colors.error : colors.success}
                  size={28}
                />
              </View>
              <Text
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                style={styles.title}
              >
                {paymentOutcome(data.state)}
              </Text>
              <Text selectable style={styles.amount}>
                {formatVnd(data.amountVnd)}
              </Text>
            </View>
            <WalletField label="Credit" value={formatCredit(data.credit)} />
            <WalletField label="Mã yêu cầu" value={data.paymentId} />
            {data.state === "REFUNDED" && (
              <Copy muted>Xem lịch sử để kiểm tra giao dịch hoàn tiền.</Copy>
            )}
            {data.state === "REVIEW" && !state.recoveryRequired && (
              <Copy muted>
                Yêu cầu đang được đối soát. Vui lòng kiểm tra lại sau.
              </Copy>
            )}
            {state.stale && state.status !== "refresh-error" && (
              <FormNotice tone="info">
                Đang hiển thị kết quả gần nhất. Kiểm tra lại để cập nhật.
              </FormNotice>
            )}
            {state.recoveryRequired && (
              <FormNotice tone="info">
                {state.recoveryReason === "PAYMENT_RECOVERY_PENDING" ? (
                  "Yêu cầu đang được khôi phục. Tiếp tục kiểm tra trạng thái trước khi nạp lại."
                ) : (
                  <>
                    Yêu cầu cần được kiểm tra hoặc đối soát. Không tạo yêu cầu
                    nạp mới.
                    {state.recoveryReason === "PAYMENT_CHANNEL_UNAVAILABLE"
                      ? " Kênh thanh toán hiện chưa sẵn sàng."
                      : " Vui lòng kiểm tra lại sau."}
                  </>
                )}
              </FormNotice>
            )}
            {state.issue === "conflict" && (
              <Copy>
                Thông tin mới chưa thể đối chiếu. Kết quả trước đó được giữ lại
                để kiểm tra tiếp.
              </Copy>
            )}
            {data.state === "PAID" &&
              refresh &&
              (["wallet", "history"] as const)
                .filter((name) => refresh[name].status === "error")
                .map((name) => (
                  <View key={name} style={{ gap: 8 }}>
                    <Copy>
                      {name === "wallet" ? "Số dư" : "Lịch sử"}: chưa cập nhật
                      được.
                    </Copy>
                    {onRefresh && refresh[name].status === "error" && (
                      <Button variant="paper" onPress={() => onRefresh(name)}>
                        {name === "wallet"
                          ? "Cập nhật lại số dư"
                          : "Cập nhật lại lịch sử"}
                      </Button>
                    )}
                  </View>
                ))}
          </View>
        )}
      </FinancialReadState>
      {canCheck && (
        <Button variant="paper" onPress={onCheck}>
          Kiểm tra lại
        </Button>
      )}
      {qrRenderError && (
        <Copy>
          Chưa hiển thị được mã minh họa. Lỗi hiển thị mã không thay đổi kết quả
          thanh toán đã ghi nhận.
        </Copy>
      )}
    </Panel>
  );
}
const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  summary: {
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderRadius: appRadius.control,
    borderWidth: 1,
    borderColor: colors.brandBorder,
    backgroundColor: colors.brandWash,
  },
  icon: {
    padding: 16,
    borderRadius: appRadius.full,
    backgroundColor: colors.brandSoft,
  },
  success: { backgroundColor: colors.successSoft },
  error: { backgroundColor: colors.errorSoft },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.brandDark,
    textAlign: "center",
  },
  amount: {
    fontFamily: fonts.bold,
    ...typography.title,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
});
