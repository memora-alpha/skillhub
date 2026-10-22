import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appRadius, fonts, typography } from "@/constants/theme";
import { paymentPalette as colors } from "./wallet-payment-palette";

export function PaymentCancelDialog({
  visible,
  disabled,
  amountLabel,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  disabled: boolean;
  amountLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Đóng xác nhận hủy thanh toán"
          onPress={onClose}
        />
        <View
          role="alertdialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel="Hủy thanh toán?"
          style={styles.card}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.icon}>
              <Icon name="close" size={24} color={colors.error} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              Hủy thanh toán?
            </Text>
            <Text style={styles.body}>
              {amountLabel
                ? `Bạn muốn hủy yêu cầu nạp ${amountLabel} này?`
                : "Bạn muốn hủy yêu cầu nạp này?"}
            </Text>
            <Button
              variant="paper"
              size="lg"
              style={styles.button}
              accessibilityLabel="Tiếp tục thanh toán"
              onPress={onClose}
            >
              Tiếp tục thanh toán
            </Button>
            <Button
              variant="ghost"
              size="lg"
              style={[styles.button, styles.confirm]}
              accessibilityLabel="Xác nhận hủy thanh toán"
              disabled={disabled}
              onPress={() => {
                if (!disabled) onConfirm();
              }}
            >
              <Text style={styles.confirmLabel}>Xác nhận hủy thanh toán</Text>
            </Button>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.backdrop,
  },
  card: {
    width: "100%",
    maxWidth: 384,
    maxHeight: "90%",
    padding: 24,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scroll: { flexGrow: 0 },
  content: { gap: 16 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: appRadius.full,
    backgroundColor: colors.errorSoft,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    textAlign: "center",
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.body,
    ...typography.body,
    textAlign: "center",
    color: colors.body,
    paddingBottom: 4,
  },
  button: { minHeight: 48, borderRadius: appRadius.control },
  confirm: { backgroundColor: colors.error },
  confirmLabel: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.white,
    textAlign: "center",
    flexShrink: 1,
  },
});
