import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { shadows } from "@/constants/shadows";
import { colors, fonts, radius } from "@/constants/theme";

export function LogoutDialog({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
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
          accessibilityRole="button"
          accessibilityLabel="Đóng xác nhận đăng xuất"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          role="alertdialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel="Đăng xuất khỏi SkillHub?"
          style={styles.card}
        >
          <View style={styles.icon}>
            <Icon name="logout" size={24} color={colors.error} />
          </View>
          <View>
            <Text style={styles.title}>Đăng xuất?</Text>
            <Text style={styles.subtitle}>
              Bạn có muốn đăng xuất khỏi tài khoản này không?
            </Text>
          </View>
          <View style={styles.actions}>
            <Button variant="ghost" onPress={onClose} style={styles.stayButton}>
              Ở lại
            </Button>
            <Button
              style={styles.logoutButton}
              onPress={onConfirm}
            >
              Đăng xuất
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(28, 20, 16, 0.42)",
  },
  card: {
    width: "100%",
    maxWidth: 384,
    padding: 24,
    gap: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    ...shadows.lg,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FCE8E4",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
    textAlign: "center",
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    color: colors.muted,
    textAlign: "center",
    includeFontPadding: false,
  },
  actions: { flexDirection: "row", gap: 8 },
  stayButton: { flex: 1 },
  logoutButton: { flex: 1, backgroundColor: colors.error },
});
