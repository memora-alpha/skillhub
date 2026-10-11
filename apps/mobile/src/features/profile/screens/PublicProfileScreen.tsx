import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { colors, fonts, signedInChrome, typography } from "@/constants/theme";
import { learningRequests } from "@/features/discovery";
import { publicProfiles } from "../mocks/publicProfiles";

export function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; requestId?: string }>();
  const profile = publicProfiles.find((item) => item.id === params.id);
  const request = learningRequests.find(
    (item) => item.id === params.requestId && item.userId === profile?.id,
  );
  const back: Href = request
    ? { pathname: "/request/[id]", params: { id: request.id } }
    : "/proposals";
  return (
    <AppScreenLayout
      title="Hồ sơ công khai"
      selected="Khám phá"
      back={{ href: back, label: "Quay lại" }}
    >
      {() =>
        !profile ? (
          <EmptyState
            title="Không tìm thấy hồ sơ"
            description="Hồ sơ này chưa có trong dữ liệu mẫu."
            action="Quay lại khám phá"
            onAction={() => router.dismissTo("/discover")}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <Avatar name={profile.name} userId={profile.id} size={72} />
              <Text accessibilityRole="header" selectable style={styles.name}>
                {profile.name}
              </Text>
              {!!profile.headline && (
                <Text style={styles.heroBody}>{profile.headline}</Text>
              )}
              <View style={styles.heroMeta}>
                {!!profile.rating && (
                  <View style={styles.row}>
                    <Icon name="star" size={14} filled color={colors.star} />
                    <Text style={styles.heroBody}>{profile.rating}</Text>
                  </View>
                )}
                {profile.reputation !== undefined && (
                  <Text style={styles.heroBody}>
                    {profile.reputation} Reputation
                  </Text>
                )}
              </View>
              <Text style={styles.demo}>Hồ sơ mẫu</Text>
            </View>
            {!!profile.stats && (
              <View style={styles.stats}>
                {profile.stats.map((stat) => (
                  <View key={stat.label} style={styles.stat}>
                    <Text selectable style={styles.statValue}>
                      {stat.value}
                    </Text>
                    <Text style={styles.caption}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.heading}>
                Giới thiệu
              </Text>
              <Text selectable style={styles.body}>
                {profile.bio ??
                  "Người dùng chưa có phần giới thiệu trong dữ liệu mẫu."}
              </Text>
            </View>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.heading}>
                Kỹ năng chia sẻ
              </Text>
              {profile.skills.length ? (
                profile.skills.map((skill) => (
                  <View key={skill.id} style={styles.skill}>
                    <View style={styles.skillName}>
                      <Text style={styles.label}>{skill.name}</Text>
                      <Badge
                        label={skill.verified ? "Đã xác minh" : "Chưa xác minh"}
                        variant={skill.verified ? "sage" : "default"}
                      />
                    </View>
                    <Text style={styles.caption}>{skill.level}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.body}>
                  Chưa có kỹ năng chia sẻ trong dữ liệu mẫu.
                </Text>
              )}
            </View>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.heading}>
                Đánh giá
              </Text>
              {profile.reviews?.length ? (
                profile.reviews.map((review) => (
                  <View key={review.name} style={styles.review}>
                    <View style={styles.row}>
                      <Avatar name={review.name} size={28} />
                      <Text style={styles.label}>{review.name}</Text>
                      <View
                        accessibilityLabel={`${review.stars}/5 sao`}
                        style={styles.row}
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Icon
                            key={star}
                            name="star"
                            size={12}
                            filled={star <= review.stars}
                            color={colors.gold}
                          />
                        ))}
                      </View>
                    </View>
                    <Text selectable style={styles.body}>
                      {review.text}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.body}>
                  Chưa có đánh giá trong dữ liệu mẫu.
                </Text>
              )}
            </View>
            <View style={styles.actions}>
              {!!request && (
                <Button
                  variant="secondary"
                  style={styles.action}
                  onPress={() => router.dismissTo(back)}
                >
                  Xem yêu cầu
                </Button>
              )}
              <Button
                style={styles.action}
                onPress={() =>
                  router.push({
                    pathname: "/send-proposal",
                    params: request
                      ? { requestId: request.id }
                      : { userId: profile.id },
                  })
                }
              >
                {request ? "Gửi đề xuất" : "Gửi lời mời trao đổi"}
              </Button>
            </View>
          </ScrollView>
        )
      }
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 840,
    alignSelf: "center",
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  hero: { padding: 24, backgroundColor: colors.ink, borderRadius: 8, gap: 8 },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    lineHeight: 34,
    color: colors.white,
  },
  heroBody: { fontFamily: fonts.body, ...typography.body, color: colors.sand },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  demo: {
    fontFamily: fonts.medium,
    ...typography.caption,
    color: colors.brandMuted,
  },
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    backgroundColor: signedInChrome.surface,
    borderRadius: 8,
    gap: 4,
  },
  statValue: {
    fontFamily: fonts.bold,
    ...typography.title,
    color: colors.brandHover,
    fontVariant: ["tabular-nums"],
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  section: {
    backgroundColor: signedInChrome.surface,
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  label: { fontFamily: fonts.semibold, ...typography.body, color: colors.ink },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  skill: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: signedInChrome.border,
  },
  skillName: { gap: 6, flexShrink: 1 },
  review: { gap: 8, paddingVertical: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: { flexGrow: 1, minHeight: 48 },
});
