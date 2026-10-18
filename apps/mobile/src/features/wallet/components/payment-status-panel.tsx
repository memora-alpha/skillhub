import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Copy, Panel, WalletField } from "./wallet-ui";
import { Icon, type IconName } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { FormNotice } from "@/components/FormNotice";
import { FinancialReadState } from "./financial-read-state";
import { formatCredit, formatVnd } from "../utils/amount";
import { paymentOutcome } from "../utils/payment-outcome";
import type {
  PaymentObservationRead,
  PaymentRefreshSnapshot,
  RelatedRead,
} from "../types/payment";

const refreshCaption: Record<RelatedRead["status"], string> = {
  unavailable: "Chưa sẵn sàng",
  idle: "Chưa cập nhật",
  loading: "Đang cập nhật…",
  success: "Đã cập nhật",
  error: "Chưa cập nhật được",
};
export function PaymentStatusPanel({
  state,
  onCheck,
  refresh,
  onRefresh,
  qrRenderError = false,
}: {
  state: PaymentObservationRead;
  onCheck?: () => void;
  refresh?: PaymentRefreshSnapshot;
  onRefresh?: (name: "wallet" | "history") => void;
  qrRenderError?: boolean;
}) {
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
    <Panel testID="wallet-payment-status">
      <FinancialReadState
        state={state}
        unavailableMessage="Chưa thể kiểm tra thanh toán. Thông tin từ liên kết, mã QR hoặc việc quay lại ứng dụng không xác nhận giao dịch."
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
                  color={tone === "error" ? colors.error : colors.forest}
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
            <WalletField
              label="Credit theo thanh toán"
              value={formatCredit(data.credit)}
            />
            <WalletField label="Mã yêu cầu" value={data.paymentId} />
            {["CREATED", "PENDING"].includes(data.state) && (
              <Copy muted>
                Đang chờ kết quả xác minh. Thời gian chờ không quyết định thất
                bại hoặc hết hạn.
              </Copy>
            )}
            {data.state === "REFUNDED" && (
              <Copy muted>
                Chỉ hiển thị thông tin đã được ghi nhận; không xác định số tiền
                hoàn hoặc thao tác rút tiền.
              </Copy>
            )}
            {data.state === "REVIEW" && (
              <Copy muted>
                Vui lòng kiểm tra lại sau. Trạng thái cần đối soát không xác
                nhận thất bại và không tạo yêu cầu nạp mới.
              </Copy>
            )}
            {state.stale && (
              <FormNotice tone="info">
                Đang hiển thị kết quả trước đó. Thông tin này chưa được cập
                nhật.
              </FormNotice>
            )}
            {state.issue === "conflict" && (
              <Copy>
                Thông tin mới chưa thể đối chiếu. Kết quả trước đó được giữ lại
                để kiểm tra tiếp.
              </Copy>
            )}
            {data.state === "PAID" && refresh && (
              <>
                <Copy muted>
                  Thanh toán đã được xác nhận. Số dư và lịch sử được cập nhật
                  riêng.
                </Copy>
                {(["wallet", "history"] as const).map((name) => (
                  <View key={name} style={{ gap: 8 }}>
                    <Copy>
                      {name === "wallet" ? "Số dư" : "Lịch sử"}:{" "}
                      {refreshCaption[refresh[name].status]}
                      {refresh[name].stale
                        ? " · dữ liệu trước đó có thể đã cũ"
                        : ""}
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
              </>
            )}
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
  summary: { alignItems: "center", gap: 12, paddingVertical: 12 },
  icon: {
    padding: 16,
    borderRadius: appRadius.full,
    backgroundColor: colors.surfaceLow,
  },
  success: { backgroundColor: colors.successSoft },
  error: { backgroundColor: colors.errorLight },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
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
