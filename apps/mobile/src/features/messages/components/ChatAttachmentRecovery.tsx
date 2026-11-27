import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, typography } from "@/constants/theme";
import { connectionError } from "@/features/connections";
import type { ApiMessage } from "../api/messages-api";
import { useAttachmentRecovery } from "../hooks/use-attachment-recovery";

export function ChatAttachmentRecovery({
  message,
  file,
}: Readonly<{
  message: ApiMessage;
  file: ApiMessage["attachments"][number];
}>) {
  const recovery = useAttachmentRecovery(message, file);
  if (recovery.denied) return null;
  const canRetry =
    recovery.status?.canRetry === true &&
    recovery.status.moderationStatus === "FAILED" &&
    recovery.status.accessStatus === "UNAVAILABLE";
  const checkOnly = recovery.uncertain || !!recovery.error;
  if (!canRetry && !checkOnly) return null;
  const label = checkOnly ? "Kiểm tra trạng thái" : "Kiểm tra lại tệp";
  return (
    <View style={styles.row}>
      {!!recovery.error && (
        <Text style={styles.error}>{connectionError(recovery.error)}</Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Kiểm tra lại tệp đã tải lên, không gửi thêm tin nhắn."
        disabled={recovery.disabled}
        onPress={() => {
          void (checkOnly ? recovery.check() : recovery.retry());
        }}
        style={({ pressed }) => [
          styles.button,
          (pressed || recovery.disabled) && styles.dimmed,
        ]}
      >
        <Text style={styles.label}>
          {recovery.pending ? "Đang kiểm tra…" : label}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { gap: 4, alignItems: "flex-end" },
  button: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.error,
  },
  error: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.error,
  },
  dimmed: { opacity: 0.45 },
});
