import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { avatarSizes, iconSizes, typography, fonts } from "@/constants/theme";
import type { Conversation } from "../mocks/conversations";
import { messageColors as colors } from "../constants/theme";

export function ChatHeader({
  conversation,
  onBack,
  onAgreement,
  live,
}: {
  conversation: Conversation;
  onBack: () => void;
  onAgreement: () => void;
  live?: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại tin nhắn"
        onPress={onBack}
        style={styles.back}
        hitSlop={6}
      >
        <View style={{ transform: [{ rotate: "180deg" }] }}>
          <Icon name="arrow" size={iconSizes.control} color={colors.inkSoft} />
        </View>
      </Pressable>
      <Avatar
        name={conversation.name}
        userId={conversation.userId}
        size={avatarSizes.compact}
      />
      <View style={styles.main}>
        <Text accessibilityRole="header" style={styles.name}>
          {conversation.name}
        </Text>
        <View style={styles.status}>
          {live === undefined || live ? <View style={styles.dot} /> : null}
          <Text style={styles.statusText}>
            {live === undefined
              ? "Đang hoạt động · Proposal đã chấp nhận"
              : live
                ? "Đề xuất đã chấp nhận · Đang cập nhật"
                : "Đề xuất đã chấp nhận"}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          live === undefined ? "Tạo thỏa thuận" : "Lộ trình học"
        }
        onPress={onAgreement}
        style={({ pressed }) => [styles.agreement, pressed && { opacity: 0.8 }]}
      >
        <Icon
          name="check-circle"
          size={iconSizes.inline}
          color={colors.white}
        />
        <Text style={styles.agreementLabel}>
          {live === undefined ? "Tạo thỏa thuận" : "Lộ trình học"}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  back: {
    width: 28,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  main: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
  },
  status: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#30A876",
  },
  statusText: {
    flex: 1,
    fontFamily: fonts.body,
    ...typography.caption,
    color: "#409678",
  },
  agreement: {
    minHeight: 36,
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: colors.orange,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  agreementLabel: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: colors.white,
    includeFontPadding: false,
  },
});
