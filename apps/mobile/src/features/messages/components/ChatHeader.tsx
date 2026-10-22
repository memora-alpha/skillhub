import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { avatarSizes, iconSizes, typography, fonts } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";

type ChatHeaderConversation = {
  proposal: string;
  name: string;
  userId: string;
  skill: string;
  request: string;
};

export function ChatHeader({
  conversation,
  onBack,
  onAgreement,
  live,
  agreementPending = false,
  topic,
  reference,
  avatarUrl,
}: Readonly<{
  conversation: ChatHeaderConversation;
  onBack: () => void;
  onAgreement: () => void;
  live?: boolean;
  agreementPending?: boolean;
  topic?: string;
  reference?: string;
  avatarUrl?: string | null;
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
        size={avatarSizes.list}
        sourceUri={avatarUrl}
      />
      <View style={styles.main}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>
          {conversation.name}
        </Text>
        <Text
          numberOfLines={1}
          accessibilityLabel={`${topic ?? (conversation.request || conversation.skill)} · ${reference ?? conversation.proposal}`}
          style={styles.topic}
        >
          {topic ?? (conversation.request || conversation.skill)}
        </Text>
        {live === false && (
          <Text style={styles.statusText}>Đang kết nối lại…</Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thỏa thuận học của hai bạn"
        disabled={agreementPending}
        accessibilityState={{
          disabled: agreementPending,
          busy: agreementPending,
        }}
        onPress={onAgreement}
        style={({ pressed }) => [styles.agreement, pressed && { opacity: 0.8 }]}
      >
        <Icon
          name="check-circle"
          size={iconSizes.inline}
          color={colors.orange}
        />
        <Text style={styles.agreementLabel}>
          {agreementPending ? "Đang mở…" : "Thỏa thuận"}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  back: {
    width: 28,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.bold, ...typography.body, color: colors.ink },
  topic: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  statusText: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
  },
  agreement: {
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: colors.orangeSoft,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  agreementLabel: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: colors.orange,
    includeFontPadding: false,
  },
});
