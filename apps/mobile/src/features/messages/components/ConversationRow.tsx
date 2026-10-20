import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { fonts, typography } from "@/constants/theme";
import { useConnections, useParticipantName } from "@/features/connections";
import type { InboxConversation } from "../utils/conversation-preview";
import { inboxTime } from "../utils/chat-dates";
import { messageColors as colors } from "../constants/theme";

export function ConversationRow({ item }: { item: InboxConversation }) {
  const { conversation } = item;
  const router = useRouter(),
    { userId } = useConnections();
  const partnerId =
    conversation.participantAId === userId
      ? conversation.participantBId
      : conversation.participantAId;
  const name = useParticipantName(partnerId);
  const displayName = name.data ?? "Người trao đổi";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Nhắn tin với ${displayName}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() =>
        router.push({
          pathname: "/chat/[proposalId]",
          params: { proposalId: conversation.id, mode: "api" },
        })
      }
    >
      <Avatar name={displayName} userId={partnerId} size={44} />
      <View style={styles.body}>
        <View style={styles.heading}>
          <Text numberOfLines={1} style={styles.name}>
            {displayName}
          </Text>
          <Text style={styles.time}>{inboxTime(item.activityAt)}</Text>
        </View>
        <View style={styles.heading}>
          {item.state === "pending" && (
            <ActivityIndicator
              size="small"
              color={colors.muted}
              accessibilityLabel="Tin nhắn chờ gửi"
            />
          )}
          {item.state === "failed" && (
            <Icon name="alert" size={12} color={colors.brand} />
          )}
          <Text numberOfLines={1} style={styles.preview}>
            {item.state === "failed" ? "Chưa gửi · " : ""}
            {item.preview}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  heading: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
  },
  preview: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
  },
  time: { fontFamily: fonts.body, ...typography.caption, color: colors.muted },
});
