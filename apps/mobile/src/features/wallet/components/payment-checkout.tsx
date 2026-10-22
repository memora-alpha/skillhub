import { ActivityIndicator, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import type { PaymentProjection } from "../types/payment";
import type { QrPresentation } from "../utils/payment-qr-model";
import { formatCredit, formatVnd } from "../utils/amount";
import { paymentState } from "../utils/payment-outcome";
import { simplePaymentCopy } from "../utils/payment-simple-copy";
import { PaymentDeadline } from "./payment-deadline";
import { PaymentQr } from "./payment-qr";
import { checkoutStyles as styles } from "./payment-checkout.styles";
import { paymentPalette as colors } from "./wallet-payment-palette";

export function PaymentCheckout({
  payment,
  qr,
  active,
  watching,
  stale = false,
  cancelUnconfirmed = false,
  synthetic = false,
}: {
  payment: PaymentProjection;
  qr: QrPresentation;
  active: boolean;
  watching: boolean;
  stale?: boolean;
  cancelUnconfirmed?: boolean;
  synthetic?: boolean;
}) {
  const hasQr =
    active &&
    !stale &&
    !cancelUnconfirmed &&
    payment.status === "PENDING" &&
    !payment.recoveryRequired &&
    !!payment.checkout &&
    qr.stage === "ready-model" &&
    qr.paymentId === payment.id &&
    qr.raw === payment.checkout.qrCode;
  const copy = simplePaymentCopy(
    {
      status: stale ? "refresh-error" : "ready",
      stale,
      data: {
        paymentId: payment.id,
        state: paymentState(payment.status),
        amountVnd: payment.paymentAmountVnd,
        credit: payment.creditAmount,
      },
      recoveryRequired: payment.recoveryRequired,
      recoveryReason: payment.recoveryReason,
    },
    hasQr,
  );
  const checking = active && watching;
  const title = cancelUnconfirmed
    ? "Đang xác nhận hủy thanh toán"
    : stale
      ? "Chưa cập nhật được thanh toán"
      : copy.title;
  const description = cancelUnconfirmed
    ? "Chưa có kết quả hủy. Vui lòng chờ cập nhật."
    : !active || !watching
      ? "Bạn có thể quay lại ví và mở lại thanh toán để cập nhật."
      : stale
        ? "Kết nối đang gián đoạn. Ứng dụng đang thử kết nối lại."
        : payment.status === "PENDING" && !payment.recoveryRequired
          ? "Mã QR tạm thời chưa hiển thị. Vui lòng chờ cập nhật."
          : copy.description;
  return (
    <View style={styles.stack} testID="payment-checkout">
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.summaryLabel}>Số tiền thanh toán</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>payOS</Text>
          </View>
        </View>
        <View style={styles.paymentSummary}>
          <Text selectable style={styles.summaryAmount}>
            {formatVnd(payment.paymentAmountVnd)}
          </Text>
          <View style={styles.summaryCredit}>
            <Text style={styles.summaryCreditLabel}>Credit nhận được</Text>
            <Text style={styles.summaryCreditValue}>
              {formatCredit(payment.creditAmount)}
            </Text>
          </View>
        </View>
        <View style={styles.qrArea}>
          {hasQr ? (
            <View style={styles.qrFrame}>
              <PaymentQr model={qr} minimal synthetic={synthetic} />
              {[
                styles.topLeft,
                styles.topRight,
                styles.bottomLeft,
                styles.bottomRight,
              ].map((corner, index) => (
                <View
                  key={index}
                  pointerEvents="none"
                  accessible={false}
                  style={[styles.corner, corner]}
                />
              ))}
            </View>
          ) : (
            <View style={styles.placeholder}>
              {checking && !cancelUnconfirmed ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Icon name="clock" size={32} color={colors.brand} />
              )}
              <Text style={[styles.title, styles.center]}>{title}</Text>
            </View>
          )}
          {!hasQr && (
            <Text style={[styles.body, styles.center]}>{description}</Text>
          )}
        </View>
        <PaymentDeadline expiresAt={payment.expiresAt} active={active} />
        {hasQr && checking && (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <View style={styles.dot} />
            <Text style={styles.statusText}>Kết quả sẽ tự động cập nhật</Text>
          </View>
        )}
        {hasQr && !checking && (
          <Text style={styles.footnote}>
            Mở lại thanh toán từ ví để tiếp tục cập nhật kết quả.
          </Text>
        )}
        <View style={styles.identity}>
          <Text style={styles.fieldLabel}>Mã thanh toán</Text>
          <Text selectable style={styles.identityValue}>
            {payment.id}
          </Text>
        </View>
      </View>
    </View>
  );
}
