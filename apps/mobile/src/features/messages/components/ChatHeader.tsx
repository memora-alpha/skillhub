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
  onDetails,
  detailsExpanded = false,
}: Readonly<{
  conversation: Conversation;
  onBack: () => void;
  onAgreement: () => void;
  onDetails?: () => void;
  detailsExpanded?: boolean;
}>) {
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
        <Text numberOfLines={1} accessibilityRole="header" style={styles.name}>
          {conversation.name}
        </Text>
        <View style={styles.status}>
          <Text style={styles.statusText}>Trao đổi kỹ năng</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Learning Path"
        onPress={onAgreement}
        style={({ pressed }) => [styles.agreement, pressed && { opacity: 0.8 }]}
      >
        <Icon
          name="check-circle"
          size={iconSizes.inline}
          color={colors.white}
        />
        <Text style={styles.agreementLabel}>Learning Path</Text>
      </Pressable>
      {onDetails && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông tin cuộc trao đổi"
          accessibilityState={{ expanded: detailsExpanded }}
          onPress={onDetails}
          style={styles.details}
        >
          <Icon
            name="clipboard"
            size={iconSizes.control}
            color={colors.inkSoft}
          />
        </Pressable>
      )}
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
  statusText: {
    flex: 1,
    fontFamily: fonts.body,
    ...typography.caption,
    color: "#409678",
  },
  agreement: {
    minHeight: 44,
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
  details: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
