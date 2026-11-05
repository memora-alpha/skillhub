import type { ReactNode } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "@/components/SafeArea";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function TerminationConfirmDialog({
  reason,
  disabled,
  closeDisabled,
  pending,
  onConfirm,
  onClose,
  feedback,
}: Readonly<{
  reason: string;
  disabled: boolean;
  closeDisabled: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
  feedback: ReactNode;
}>) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View
          role="alertdialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel="Gửi yêu cầu hủy?"
          style={styles.card}
        >
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <Text accessibilityRole="header" style={styles.title}>
              Gửi yêu cầu hủy?
            </Text>
            <Text style={styles.body}>
              Yêu cầu áp dụng cho toàn bộ lộ trình.
            </Text>
            <View style={styles.reason}>
              <Text style={styles.label}>Lý do hủy</Text>
              <Text style={styles.body}>{reason}</Text>
            </View>
            <FormNotice tone="warning" compact>
              Lịch học vẫn có hiệu lực đến khi việc hủy được thực hiện.
            </FormNotice>
            <Text style={styles.important}>
              Credit chưa được hoàn ngay; xử lý theo quyết định hủy.
            </Text>
            <View style={styles.actions}>
              <Button variant="danger" disabled={disabled} onPress={onConfirm}>
                {pending ? "Đang gửi..." : "Xác nhận gửi yêu cầu"}
              </Button>
              <Button
                variant="ghost"
                disabled={closeDisabled}
                onPress={onClose}
              >
                Quay lại
              </Button>
            </View>
            {feedback}
          </ScrollView>
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
    backgroundColor: "rgba(28, 37, 32, 0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "90%",
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  content: { padding: 24, gap: 16 },
  title: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
  body: { ...typography.body, fontFamily: fonts.body, color: colors.body },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  reason: {
    padding: 12,
    gap: 6,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  important: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.error,
  },
  actions: { gap: 4 },
});
