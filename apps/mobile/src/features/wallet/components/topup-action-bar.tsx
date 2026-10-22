import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appRadius, fonts, typography } from "@/constants/theme";
import { paymentPalette as colors } from "./wallet-payment-palette";
import { PaymentAction } from "./payment-action";
import type { PaymentCoordinator } from "../utils/payment-create-coordinator";
import type { PaymentCreateSnapshot } from "../utils/payment-create-state";

export function TopupActionBar({
  model,
  state,
  active,
}: {
  model: PaymentCoordinator;
  state: PaymentCreateSnapshot;
  active: boolean;
}) {
  const review = state.stage === "review" && !!state.review;
  const disabled = !active || state.busy;
  const gradientColors = disabled
    ? ([colors.disabledStart, colors.disabledEnd] as const)
    : ([colors.ctaStart, colors.ctaMiddle, colors.ctaEnd] as const);

  return (
    <View style={styles.footer} testID="wallet-topup-action-bar">
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      >
        <Button
          variant="craft"
          size="lg"
          style={styles.submit}
          disabled={disabled}
          accessibilityLabel={
            review ? "Xác nhận và tạo mã QR" : "Xem lại thông tin"
          }
          onPress={() => {
            if (disabled) return;
            if (review) void model.confirm();
            else void model.review();
          }}
        >
          <Text style={styles.submitLabel}>
            {review ? "Xác nhận và tạo mã QR" : "Xem lại thông tin"}
          </Text>
          <Icon name="arrow" color={colors.white} size={18} />
        </Button>
      </LinearGradient>
      {review && (
        <PaymentAction
          variant="ghost"
          onPress={model.back}
          disabled={!active || state.busy}
        >
          Đổi số tiền
        </PaymentAction>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: "#2E1E17",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    width: "100%",
    minHeight: 52,
    borderRadius: appRadius.card,
    shadowColor: "#B84D26",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  submit: {
    width: "100%",
    minHeight: 52,
    borderRadius: appRadius.card,
    backgroundColor: "transparent",
    justifyContent: "center",
  },
  submitLabel: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.white,
  },
});
