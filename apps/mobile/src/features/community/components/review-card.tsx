import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { ReviewStars } from "./review-stars";

export function ReviewCard({
  name,
  userId,
  rating,
  comment,
  createdAt,
  own = false,
  subject,
}: Readonly<{
  name: string;
  userId?: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  own?: boolean;
  subject?: string;
}>) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar name={name} userId={userId} size={40} />
        <View style={styles.identity}>
          {subject && <Text style={styles.date}>{subject}</Text>}
          <Text selectable style={styles.name}>
            {name}
          </Text>
          <Text style={styles.date}>
            {new Date(createdAt).toLocaleDateString("vi-VN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>
        {own && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Đã gửi</Text>
          </View>
        )}
      </View>
      <ReviewStars rating={rating} />
      {!!comment?.trim() && (
        <Text selectable style={styles.comment}>
          {comment}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.bold, ...typography.body, color: colors.ink },
  date: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.forestSoft,
    borderRadius: appRadius.badge,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: colors.forest,
  },
  comment: { fontFamily: fonts.body, ...typography.body, color: colors.body },
});
