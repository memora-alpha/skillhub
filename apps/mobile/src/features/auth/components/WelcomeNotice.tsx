import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { shadows } from "@/constants/shadows";
import { colors, fonts, radius } from "@/constants/theme";

export function WelcomeNotice({
  title,
  onClose,
}: {
  title: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={title !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng thông báo"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View accessibilityViewIsModal style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.description}>
            Màn này sẽ được triển khai tiếp theo. Hiện bạn có thể khám phá màn
            chào SkillHub.
          </Text>
          <Button onPress={onClose}>Quay lại màn chào</Button>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    width: "100%",
    maxWidth: 384,
    padding: 24,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    gap: 24,
    ...shadows.lg,
  },
  title: {
    includeFontPadding: false,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 28,
    textAlign: "center",
    color: colors.ink,
  },
  description: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: colors.muted,
  },
});
