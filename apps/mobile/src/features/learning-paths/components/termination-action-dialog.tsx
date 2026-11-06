import type { ReactNode } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormNotice } from "@/components/FormNotice";
import { SafeAreaView } from "@/components/SafeArea";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export type TerminationAction = "accept" | "decline" | "withdraw" | "escalate";
const content = {
  accept: {
    title: "Đồng ý hủy lộ trình?",
    description:
      "Các buổi tương lai sẽ dừng. Hệ thống tự tính Credit theo dữ liệu buổi học.",
    confirm: "Xác nhận đồng ý",
  },
  decline: {
    title: "Không đồng ý hủy?",
    description: "Yêu cầu sẽ chuyển cho nhân viên xem xét.",
    confirm: "Xác nhận không đồng ý",
  },
  withdraw: {
    title: "Rút yêu cầu hủy?",
    description: "Yêu cầu này sẽ được đóng. Lộ trình tiếp tục như cũ.",
    confirm: "Xác nhận rút yêu cầu",
  },
  escalate: {
    title: "Nhờ nhân viên hỗ trợ",
    description: "Nhân viên sẽ xem lại yêu cầu hủy của hai bên.",
    confirm: "Gửi yêu cầu hỗ trợ",
  },
} as const;

export function TerminationActionDialog({
  action,
  note,
  onNoteChange,
  disabled,
  closeDisabled,
  noteDisabled,
  pending,
  onConfirm,
  onClose,
  feedback,
}: Readonly<{
  action: TerminationAction;
  note: string;
  onNoteChange: (value: string) => void;
  disabled: boolean;
  closeDisabled: boolean;
  noteDisabled: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
  feedback: ReactNode;
}>) {
  const copy = content[action];
  const needsNote = action === "decline" || action === "escalate";
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View
          role="alertdialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel={copy.title}
          style={styles.card}
        >
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <Text accessibilityRole="header" style={styles.title}>
              {copy.title}
            </Text>
            <Text style={styles.body}>{copy.description}</Text>
            {needsNote && (
              <Input
                label={
                  action === "decline"
                    ? "Lý do không đồng ý"
                    : "Bạn cần hỗ trợ điều gì?"
                }
                required={action === "escalate"}
                value={note}
                onChangeText={onNoteChange}
                editable={!noteDisabled}
                multiline
                maxLength={1000}
                hint={
                  action === "escalate"
                    ? "Từ 3 đến 1.000 ký tự."
                    : "Không bắt buộc."
                }
              />
            )}
            {action !== "withdraw" && (
              <FormNotice tone="warning" compact>
                {action === "accept"
                  ? "Nếu còn tranh chấp hoặc buổi học chưa có kết luận, Credit sẽ chờ xử lý."
                  : "Lịch học vẫn có hiệu lực đến khi đối tác hoặc nhân viên duyệt hủy."}
              </FormNotice>
            )}
            {action === "accept" && (
              <FormNotice tone="error" compact>
                Sau khi đồng ý, không thể rút yêu cầu hủy.
              </FormNotice>
            )}
            <View style={styles.actions}>
              <Button
                variant={
                  action === "accept" || action === "withdraw"
                    ? "danger"
                    : "forest"
                }
                disabled={disabled}
                onPress={onConfirm}
              >
                {pending ? "Đang gửi..." : copy.confirm}
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
    justifyContent: "center",
    alignItems: "center",
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
  actions: { gap: 4 },
});
