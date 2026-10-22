import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { PaymentCancelDialog } from "./payment-cancel-dialog";
import { formatVnd } from "../utils/amount";
import type { PaymentCreateSnapshot } from "../utils/payment-create-state";
import { appRadius, fonts, typography } from "@/constants/theme";
import { paymentPalette as colors } from "./wallet-payment-palette";

export function PaymentCancelAction({
  state,
  active,
  onCancel,
}: {
  state: PaymentCreateSnapshot;
  active: boolean;
  onCancel: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const busy = state.busy && !state.checking;
  const cancelling = !!state.cancelling;
  // A read never disables opening the dialog. Confirmed cancellation rechecks
  // stale data in the coordinator before it can send a financial command.
  const showAction =
    !state.readDenied &&
    (state.payment
      ? state.stage === "known" &&
        state.payment.gateway === "PAYOS" &&
        ["CREATED", "PENDING"].includes(state.payment.status)
      : state.canCancel || cancelling);
  const disabled = !active || busy;
  const label =
    cancelling && state.cancelUnconfirmed
      ? "Đang hủy thanh toán…"
      : cancelling
        ? "Đang xử lý yêu cầu hủy…"
        : state.cancelUnconfirmed
          ? "Thử hủy lại"
          : "Hủy thanh toán";
  const visible = !!state.cancelNotice || showAction;
  useEffect(() => {
    if (!active || !showAction) setConfirming(false);
  }, [active, showAction]);
  if (!visible) return null;
  return (
    <View style={styles.actions}>
      {state.cancelNotice && (
        <FormNotice tone="info">{state.cancelNotice}</FormNotice>
      )}
      {showAction && (
        <Button
          variant="ghost"
          size="lg"
          style={styles.cancel}
          accessibilityLabel={label}
          disabled={disabled}
          onPress={() => {
            if (!disabled) setConfirming(true);
          }}
        >
          <Text style={styles.label}>{label}</Text>
        </Button>
      )}
      <PaymentCancelDialog
        visible={!!showAction && active && confirming}
        disabled={disabled}
        amountLabel={
          state.payment ? formatVnd(state.payment.paymentAmountVnd) : undefined
        }
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          if (disabled) return;
          setConfirming(false);
          onCancel();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  cancel: {
    minHeight: 48,
    borderRadius: appRadius.control,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorSoft,
  },
  label: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.error,
    flexShrink: 1,
    textAlign: "center",
  },
});
