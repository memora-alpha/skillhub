import { Modal, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { colors, fonts } from "@/constants/theme";

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
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View
          role="alertdialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel="Đăng xuất khỏi SkillHub?"
          style={styles.card}
        >
          <View style={styles.icon}>
            <Icon name="logout" size={28} color={colors.muted} />
          </View>
          <View>
            <Text style={styles.title}>Đăng xuất khỏi SkillHub?</Text>
            <Text style={styles.subtitle}>
              Bạn sẽ cần đăng nhập lại để tiếp tục.
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            <Button
              style={{ backgroundColor: colors.error }}
              onPress={onConfirm}
            >
              Đăng xuất
            </Button>
            <Button variant="ghost" onPress={onClose}>
              Ở lại
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
    backgroundColor: colors.cream,
  },
  card: {
    width: "100%",
    maxWidth: 384,
    padding: 24,
    gap: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.sand,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 28,
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
});
