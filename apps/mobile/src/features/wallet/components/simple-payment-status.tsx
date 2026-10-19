import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PaymentAction } from "./payment-action";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { Copy } from "./wallet-ui";
import {
  PaymentSurface,
  paymentSurfaceStyles as surface,
} from "./payment-surface";
import { formatCredit, formatVnd } from "../utils/amount";
import { simplePaymentCopy } from "../utils/payment-simple-copy";
import type {
  PaymentObservationRead,
  PaymentRefreshSnapshot,
} from "../types/payment";

export function SimplePaymentStatus({
  state,
  onCheck,
  refresh,
  onRefresh,
  busy = false,
  hasQr = false,
  children,
  automatic = false,
  watching = false,
}: {
  state: PaymentObservationRead;
  onCheck?: () => void;
  refresh?: PaymentRefreshSnapshot;
  onRefresh?: (name: "wallet" | "history") => void;
  busy?: boolean;
  hasQr?: boolean;
  children?: ReactNode;
  automatic?: boolean;
  watching?: boolean;
}) {
  const view = simplePaymentCopy(state, hasQr),
    pending = busy || ["loading", "refreshing"].includes(state.status);
  const failedReads = (["wallet", "history"] as const).filter(
    (name) => refresh?.[name].status === "error",
  );
  const terminal = ["PAID", "FAILED", "EXPIRED", "REFUNDED"].includes(
    state.data?.state ?? "",
  );
  const description =
    !automatic || terminal || (!view.showAmount && state.status !== "error")
      ? view.description
      : state.status === "error"
        ? "Kết nối đang gián đoạn. App sẽ cập nhật khi kết nối trở lại."
        : state.data?.state === "CREATED"
          ? watching
            ? "Mã QR sẽ xuất hiện khi sẵn sàng."
            : "Yêu cầu vẫn đang xử lý. Bạn có thể quay lại ví."
          : hasQr
            ? "Dùng ứng dụng ngân hàng trên thiết bị khác để quét mã."
            : state.data?.state === "REVIEW"
              ? "Yêu cầu đang được đối soát. Bạn có thể quay lại ví."
              : view.error
                ? view.description
                : watching
                  ? "Thông tin thanh toán đang được cập nhật tự động."
                  : "Chưa có kết quả mới. Bạn có thể quay lại ví và mở thanh toán sau.";
  return (
    <PaymentSurface testID="wallet-payment-status">
      <View style={styles.summary}>
        {hasQr && <Text style={surface.caption}>NẠP VÀO VÍ CREDIT</Text>}
        {!hasQr && (
          <View
            style={[
              styles.icon,
              view.success && styles.success,
              view.error && styles.error,
            ]}
          >
            {pending && !view.showAmount ? (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                accessibilityLabel="Đang cập nhật thanh toán"
              />
            ) : (
              <Icon
                name={
                  view.success ? "check-circle" : view.error ? "alert" : "clock"
                }
                size={32}
                color={view.error ? colors.error : colors.forest}
              />
            )}
          </View>
        )}
        {!hasQr && (
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={styles.title}
          >
            {view.title}
          </Text>
        )}
        {view.showAmount && (
          <>
            <Text selectable style={surface.amount}>
              {formatVnd(state.data!.amountVnd)}
            </Text>
            <Text style={surface.credit}>
              {formatCredit(state.data!.credit)}
            </Text>
          </>
        )}
        {!hasQr && <Text style={styles.description}>{description}</Text>}
      </View>
      {hasQr && (
        <>
          <View style={surface.divider} />
          <Text accessibilityRole="header" style={styles.title}>
            {view.title}
          </Text>
        </>
      )}
      {children && (
        <View style={hasQr ? styles.qrFrame : undefined}>{children}</View>
      )}
      {hasQr && <Text style={styles.description}>{description}</Text>}
      {automatic && watching && view.showAmount && (
        <Text style={surface.caption}>Đang chờ xác nhận thanh toán…</Text>
      )}
      {!automatic && pending && hasQr && (
        <Copy muted>Đang kiểm tra thanh toán…</Copy>
      )}
      {view.success && failedReads.length > 0 && (
        <>
          <Copy muted>
            Thanh toán đã thành công. Số dư hoặc lịch sử chưa kịp cập nhật.
          </Copy>
          {!automatic && onRefresh && (
            <PaymentAction
              variant="paper"
              onPress={() => failedReads.forEach(onRefresh)}
            >
              Cập nhật ví
            </PaymentAction>
          )}
        </>
      )}
      {state.stale && view.showAmount && (
        <Copy muted>
          {automatic
            ? "Đang hiển thị kết quả gần nhất. App sẽ cập nhật khi có thông tin mới."
            : "Đang hiển thị kết quả gần nhất. Vui lòng kiểm tra lại để cập nhật."}
        </Copy>
      )}
      {view.success && state.recoveryRequired && (
        <Copy muted>
          Một số thông tin đang được kiểm tra thêm. Liên hệ hỗ trợ nếu cần.
        </Copy>
      )}
      {!automatic && view.canCheck && onCheck && (
        <PaymentAction
          variant={hasQr ? "craft" : "paper"}
          disabled={pending}
          onPress={onCheck}
        >
          {pending
            ? "Đang kiểm tra…"
            : hasQr
              ? "Kiểm tra thanh toán"
              : "Kiểm tra lại"}
        </PaymentAction>
      )}
    </PaymentSurface>
  );
}
const styles = StyleSheet.create({
  summary: { alignItems: "center", gap: 12, paddingVertical: 12 },
  qrFrame: {
    borderRadius: appRadius.feature,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: colors.white,
  },
  icon: {
    padding: 20,
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
  description: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
    textAlign: "center",
  },
});
