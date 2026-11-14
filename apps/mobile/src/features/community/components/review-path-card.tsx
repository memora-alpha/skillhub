import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import { useParticipantProfile } from "@/features/connections";
import type { PathSummary } from "@/features/learning-paths";
import { reviewStyles as styles } from "./review.styles";

export function ReviewPathCard({ path }: Readonly<{ path: PathSummary }>) {
  const router = useRouter();
  const profile = useParticipantProfile(path.counterpartId);
  const name = profile.data?.fullName ?? "Người trao đổi";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem đánh giá: ${path.title?.trim() || "Lộ trình"}, cùng ${name}`}
      onPress={() => router.push(`/paths/${path.id}/review`)}
      style={({ pressed }) => [styles.pathCard, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.status}>
          <Icon name="check-circle" size={14} color={colors.forest} />
          <Text style={styles.statusText}>Đã hoàn tất</Text>
        </View>
        <Text style={styles.meta}>
          {path.exchangeType === "TWO_WAY"
            ? "Trao đổi hai chiều"
            : path.exchangeType === "ONE_WAY"
              ? "Học một chiều"
              : "Lộ trình học"}
        </Text>
      </View>
      <Text style={styles.cardTitle}>
        {path.title?.trim() || "Lộ trình học cùng đối tác"}
      </Text>
      <View style={styles.partner}>
        <Avatar
          name={name}
          userId={path.counterpartId}
          sourceUri={profile.data?.avatarUrl}
          size={40}
        />
        <View style={styles.grow}>
          <Text style={styles.meta}>Học cùng</Text>
          <Text style={styles.partnerName}>{name}</Text>
        </View>
      </View>
      <View style={[styles.row, styles.cardFooter]}>
        <Text style={styles.action}>Xem đánh giá</Text>
        <Icon name="arrow" size={18} color={colors.primary} />
      </View>
    </Pressable>
  );
}
