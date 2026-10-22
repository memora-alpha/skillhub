import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PaymentAction } from "./payment-action";
import { Icon, type IconName } from "@/components/Icon";
import { appRadius, fonts, typography } from "@/constants/theme";
import { Copy } from "./wallet-ui";
import {
  PaymentSurface,
  paymentSurfaceStyles as surface,
} from "./payment-surface";
import { formatCredit, formatVnd } from "../utils/amount";
import { simplePaymentCopy } from "../utils/payment-simple-copy";
import { isTerminalPaymentStatus } from "../utils/payment-outcome";
import type {
  PaymentObservationRead,
  PaymentRefreshSnapshot,
} from "../types/payment";
import { paymentPalette as colors } from "./wallet-payment-palette";

type StatusProps = {
  state: PaymentObservationRead;
  onCheck?: () => void;
  refresh?: PaymentRefreshSnapshot;
  onRefresh?: (name: "wallet" | "history") => void;
  busy?: boolean;
  hasQr?: boolean;
  children?: ReactNode;
  automatic?: boolean;
  watching?: boolean;
};
type StatusCopy = ReturnType<typeof simplePaymentCopy>;

function statusDescription(
  { state, automatic, watching, hasQr }: StatusProps,
  view: StatusCopy,
) {
  if (
    !automatic ||
    isTerminalPaymentStatus(state.data?.state ?? "") ||
    state.recoveryReason === "PAYMENT_RECOVERY_PENDING" ||
    (!view.showAmount && state.status !== "error")
  )
    return view.description;
  if (state.status === "error")
    return "Kết nối đang gián đoạn. App sẽ cập nhật khi kết nối trở lại.";
  if (state.data?.state === "CREATED")
    return watching
      ? "Mã QR sẽ xuất hiện khi sẵn sàng."
      : "Yêu cầu vẫn đang xử lý. Bạn có thể quay lại ví.";
  if (hasQr) return "Dùng ứng dụng ngân hàng trên thiết bị khác để quét mã.";
  if (state.data?.state === "REVIEW")
    return "Yêu cầu đang được đối soát. Bạn có thể quay lại ví.";
  if (view.error) return view.description;
  return watching
    ? "Thông tin thanh toán đang được cập nhật tự động."
    : "Chưa có kết quả mới. Bạn có thể quay lại ví và mở thanh toán sau.";
}

function StatusIcon({ pending, view }: { pending: boolean; view: StatusCopy }) {
  let name: IconName = "clock";
  if (view.success) name = "check-circle";
  else if (view.error) name = "alert";
  return (
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
          color={colors.brand}
          accessibilityLabel="Đang cập nhật thanh toán"
        />
      ) : (
        <Icon
          name={name}
          size={32}
          color={view.error ? colors.error : colors.success}
        />
      )}
    </View>
  );
}

function StatusSummary({
  state,
  hasQr,
  pending,
  view,
  description,
}: {
  state: PaymentObservationRead;
  hasQr: boolean;
  pending: boolean;
  view: StatusCopy;
  description: string;
}) {
  return (
    <View style={styles.summary}>
      {hasQr && <Text style={surface.caption}>NẠP VÀO VÍ CREDIT</Text>}
      {!hasQr && <StatusIcon pending={pending} view={view} />}
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
          <Text style={surface.credit}>{formatCredit(state.data!.credit)}</Text>
        </>
      )}
      {!hasQr && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

function StatusActions({
  state,
  view,
  automatic,
  onRefresh,
  refresh,
  hasQr,
  pending,
  onCheck,
}: StatusProps & { view: StatusCopy; pending: boolean }) {
  const failedReads = (["wallet", "history"] as const).filter(
    (name) => refresh?.[name].status === "error",
  );
  let checkLabel = hasQr ? "Kiểm tra thanh toán" : "Kiểm tra lại";
  if (pending) checkLabel = "Đang kiểm tra…";
  return (
    <>
      {view.success && failedReads.length > 0 && (
        <>
          <Copy muted>Số dư hoặc lịch sử chưa kịp cập nhật.</Copy>
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
        <Copy muted>Một số thông tin đang được kiểm tra thêm.</Copy>
      )}
      {!automatic && view.canCheck && onCheck && (
        <PaymentAction
          variant={hasQr ? "craft" : "paper"}
          disabled={pending}
          onPress={onCheck}
        >
          {checkLabel}
        </PaymentAction>
      )}
    </>
  );
}

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
}: StatusProps) {
  const view = simplePaymentCopy(state, hasQr),
    pending = busy || ["loading", "refreshing"].includes(state.status);
  const description = statusDescription(
    { state, automatic, watching, hasQr },
    view,
  );
  return (
    <PaymentSurface testID="wallet-payment-status">
      <StatusSummary
        state={state}
        hasQr={hasQr}
        pending={pending}
        view={view}
        description={description}
      />
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
      <StatusActions
        state={state}
        view={view}
        automatic={automatic}
        onRefresh={onRefresh}
        refresh={refresh}
        hasQr={hasQr}
        pending={pending}
        onCheck={onCheck}
      />
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
    backgroundColor: colors.surface,
  },
  icon: {
    padding: 20,
    borderRadius: appRadius.full,
    backgroundColor: colors.surfaceLow,
  },
  success: { backgroundColor: colors.successSoft },
  error: { backgroundColor: colors.errorSoft },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.brandDark,
    textAlign: "center",
  },
  description: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
    textAlign: "center",
  },
});
