import { Text, View } from "react-native";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
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

type CheckoutProps = {
  payment: PaymentProjection;
  qr: QrPresentation;
  active: boolean;
  watching: boolean;
  stale?: boolean;
  cancelUnconfirmed?: boolean;
  synthetic?: boolean;
};

function canShowQr({
  payment,
  qr,
  active,
  stale,
  cancelUnconfirmed,
}: CheckoutProps) {
  return (
    active &&
    !stale &&
    !cancelUnconfirmed &&
    payment.status === "PENDING" &&
    !payment.recoveryRequired &&
    !!payment.checkout &&
    qr.stage === "ready-model" &&
    qr.paymentId === payment.id &&
    qr.raw === payment.checkout.qrCode
  );
}

function checkoutDescription(props: CheckoutProps, fallback: string) {
  if (props.cancelUnconfirmed)
    return "Chưa có kết quả hủy. Vui lòng chờ cập nhật.";
  if (!props.active || !props.watching)
    return "Bạn có thể quay lại ví và mở lại thanh toán để cập nhật.";
  if (props.stale)
    return "Kết nối đang gián đoạn. Ứng dụng đang thử kết nối lại.";
  if (props.payment.status === "PENDING" && !props.payment.recoveryRequired)
    return "Mã QR tạm thời chưa hiển thị. Vui lòng chờ cập nhật.";
  return fallback;
}

function QrFrame({
  qr,
  synthetic,
}: {
  qr: QrPresentation;
  synthetic: boolean;
}) {
  const corners = [
    { id: "top-left", style: styles.topLeft },
    { id: "top-right", style: styles.topRight },
    { id: "bottom-left", style: styles.bottomLeft },
    { id: "bottom-right", style: styles.bottomRight },
  ];
  return (
    <View style={styles.qrFrame}>
      <PaymentQr model={qr} minimal synthetic={synthetic} />
      {corners.map((corner) => (
        <View
          key={corner.id}
          pointerEvents="none"
          accessible={false}
          style={[styles.corner, corner.style]}
        />
      ))}
    </View>
  );
}

export function PaymentCheckout({
  payment,
  qr,
  active,
  watching,
  stale = false,
  cancelUnconfirmed = false,
  synthetic = false,
}: CheckoutProps) {
  const props = { payment, qr, active, watching, stale, cancelUnconfirmed };
  const hasQr = canShowQr(props);
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
  let title = copy.title;
  if (cancelUnconfirmed) title = "Đang xác nhận hủy thanh toán";
  else if (stale) title = "Chưa cập nhật được thanh toán";
  const description = checkoutDescription(props, copy.description);
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
            <QrFrame qr={qr} synthetic={synthetic} />
          ) : (
            <View style={styles.placeholder}>
              {checking && !cancelUnconfirmed ? (
                <ActivityIndicator />
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
