import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";
import type { Conversation } from "../mocks/conversations";

export function ChatHeader({
  conversation,
  onBack,
  onAgreement,
}: {
  conversation: Conversation;
  onBack: () => void;
  onAgreement: () => void;
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
          <Icon name="arrow" size={16} color={colors.inkSoft} />
        </View>
      </Pressable>
      <Avatar name={conversation.name} size={40} />
      <View style={styles.main}>
        <Text accessibilityRole="header" style={styles.name} numberOfLines={1}>
          {conversation.name}
        </Text>
        <Text style={styles.proposal}>Proposal #{conversation.proposal}</Text>
        <View style={styles.status}>
          <View style={styles.dot} />
          <Text style={styles.statusText} numberOfLines={1}>
            Đang hoạt động · Proposal đã chấp nhận
          </Text>
        </View>
      </View>
      <Button size="sm" onPress={onAgreement}>
        Tạo thỏa thuận
      </Button>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  back: { padding: 4 },
  main: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  proposal: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.muted,
  },
  status: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  statusText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.success,
  },
});
