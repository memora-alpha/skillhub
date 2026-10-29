import { Pressable, StyleSheet, View } from "react-native";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { Icon } from "@/components/Icon";
import { appColors as colors, appRadius } from "@/constants/theme";

export function NotificationActions({
  refreshing,
  disabled,
  onRefresh,
}: {
  refreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Làm mới thông báo"
        accessibilityState={{ disabled, busy: refreshing }}
        disabled={disabled}
        onPress={onRefresh}
        style={({ pressed }) => [
          styles.button,
          (disabled || pressed) && styles.dimmed,
        ]}
      >
        {refreshing ? (
          <ActivityIndicator presentation="inline" size="small" />
        ) : (
          <Icon name="refresh" size={18} color={colors.primary} />
        )}
      </Pressable>
      {/* TODO: Enable once the backend supports marking the entire inbox read.
          GET /notifications and PATCH /notifications/:id/read are the only current contracts. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đánh dấu tất cả thông báo đã đọc"
        accessibilityHint="Chưa khả dụng, đang chờ hỗ trợ từ máy chủ"
        accessibilityState={{ disabled: true }}
        disabled
        style={[styles.button, styles.dimmed]}
      >
        <Icon name="checks" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 4 },
  button: {
    width: 44,
    height: 44,
    borderRadius: appRadius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  dimmed: { opacity: 0.45 },
});
