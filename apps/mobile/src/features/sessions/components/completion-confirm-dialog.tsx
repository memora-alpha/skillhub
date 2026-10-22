import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import { SessionButton } from "./session-page";

export function CompletionConfirmDialog({
  visible,
  onCancel,
  onConfirm,
}: Readonly<{
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Đóng xác nhận buổi học"
          onPress={onCancel}
        />
        <View
          role="alertdialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel="Xác nhận buổi học?"
          style={styles.card}
        >
          <View style={styles.icon}>
            <Icon name="check-circle" size={28} color={colors.forest} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            Xác nhận buổi học?
          </Text>
          <ScrollView style={styles.content}>
            <Text style={styles.body}>
              Bạn xác nhận đã tham gia và hoàn thành buổi học này? Buổi học chỉ
              hoàn thành khi cả hai bên xác nhận.
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <View style={styles.grow}>
              <SessionButton variant="paper" onPress={onCancel}>
                Hủy
              </SessionButton>
            </View>
            <View style={styles.grow}>
              <SessionButton onPress={onConfirm}>Xác nhận</SessionButton>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(28, 25, 23, 0.4)",
  },
  card: {
    width: "100%",
    maxWidth: 384,
    maxHeight: "90%",
    padding: 24,
    gap: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  icon: {
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.forestSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
    textAlign: "center",
  },
  content: { flexGrow: 0, flexShrink: 1 },
  body: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
    textAlign: "center",
  },
  actions: { flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
});
