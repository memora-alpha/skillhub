import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { SafeAreaView } from "@/components/SafeArea";
import { typography, colors, fonts, radius } from "@/constants/theme";
import { Icon } from "./Icon";
import { Button } from "./Button";

export function InfoModal({
  title,
  children,
  onClose,
  confirmLabel = "Đã hiểu",
  onConfirm,
  style,
}: {
  title: string | null;
  children?: ReactNode;
  onClose: () => void;
  confirmLabel?: string;
  onConfirm?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Modal
      visible={title !== null}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng hộp thoại"
        />
        <View
          accessibilityViewIsModal
          role="dialog"
          aria-modal
          accessibilityLabel={title ?? undefined}
          style={[styles.card, style]}
        >
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              hitSlop={10}
            >
              <Icon name="close" color={colors.muted} size={20} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ gap: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {typeof children === "string" ? (
              <Text style={styles.body}>{children}</Text>
            ) : (
              children
            )}
          </ScrollView>
          <Button onPress={onConfirm ?? onClose}>{confirmLabel}</Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#1C141066",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 448,
    maxHeight: "90%",
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 20,
  },
  heading: { flexDirection: "row", gap: 12, alignItems: "center" },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.ink,
    includeFontPadding: false,
  },
  content: { flexGrow: 0 },
  body: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.muted,
    includeFontPadding: false,
  },
});
