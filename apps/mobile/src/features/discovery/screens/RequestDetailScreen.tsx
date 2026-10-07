import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { avatarSizes, iconSizes, typography, fonts } from "@/constants/theme";
import { discoveryColors as colors } from "../constants/theme";
import { RequestDetailSections } from "../components/RequestDetailSections";
import { learningRequests } from "../mocks/requests";
import { requestDetails } from "../mocks/requestDetails";

export function RequestDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const request = learningRequests.find((item) => item.id === id);
  const detail = request ? requestDetails[request.id] : undefined;
  return (
    <AppScreenLayout
      title="Chi tiết yêu cầu"
      selected="Khám phá"
      contentStyle={styles.background}
      back={{ href: "/discover", label: "Quay lại yêu cầu học" }}
    >
      {(open) =>
        !request ? (
          <EmptyState
            title="Không tìm thấy yêu cầu học"
            description="Yêu cầu này không có trong dữ liệu demo."
            action="Quay lại khám phá"
            onAction={() => router.dismissTo("/discover")}
          />
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.requestHeader}>
                <View style={styles.header}>
                  <Badge label="Đang mở" variant="success" />
                  <Text style={styles.requestCode}>Mã: {request.id}</Text>
                </View>
                <Text accessibilityRole="header" style={styles.title}>
                  {request.title}
                </Text>
                <View style={styles.tags}>
                  {(
                    detail?.hashtags ?? request.tags.map((tag) => `#${tag}`)
                  ).map((tag) => (
                    <View key={tag} style={styles.hashtag}>
                      <Text style={styles.hashtagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.meta}>
                  <View style={styles.metaItem}>
                    <Icon name="clock" size={iconSizes.inline} color={colors.muted} />
                    <Text style={styles.caption}>Đăng {request.created}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="calendar" size={iconSizes.inline} color={colors.muted} />
                    <Text style={styles.caption}>
                      {request.sessions} buổi
                      {detail ? ` · ${detail.duration}` : ""}
                    </Text>
                  </View>
                </View>
              </View>
              <RequestDetailSections detail={detail} />
              <View style={styles.budget}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.budgetCaption}>NGÂN SÁCH TRAO ĐỔI</Text>
                  <Text style={styles.amount}>
                    {request.budget.split("/")[0]}
                    <Text style={styles.budgetNote}> / lộ trình</Text>
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.caption}>Tổng dự kiến</Text>
                  <Text style={styles.total}>
                    {request.budget.split("/")[0]}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Xem hồ sơ ${request.user}`}
                onPress={() => open(`Hồ sơ ${request.user}`)}
                style={styles.poster}
              >
                <Avatar
                  name={request.user}
                  userId={request.userId}
                  size={avatarSizes.list}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.label}>{request.user}</Text>
                  <View style={styles.posterMeta}>
                    {detail ? (
                      <>
                        <Text style={styles.reputation}>
                          {detail.reputation} Reputation
                        </Text>
                        <Text style={styles.caption}>{detail.memberSince}</Text>
                      </>
                    ) : (
                      <Text style={styles.caption}>
                        Thông tin hồ sơ đang được cập nhật.
                      </Text>
                    )}
                  </View>
                </View>
                <Icon name="chevron" size={iconSizes.control} color={colors.muted} />
              </Pressable>
            </ScrollView>
            <View style={styles.actions}>
              <View style={styles.actionRow}>
                <Button
                  variant="paper"
                  style={styles.profileButton}
                  onPress={() => open(`Hồ sơ ${request.user}`)}
                >
                  <Text style={styles.profileButtonText}>Xem hồ sơ</Text>
                </Button>
                <Button
                  variant="craft"
                  style={styles.contactButton}
                  accessibilityLabel="Liên hệ trao đổi"
                  onPress={() => open("Gửi Proposal")}
                >
                  <Icon name="message" size={iconSizes.control} color={colors.surface} />
                  <Text style={styles.buttonText}>Liên hệ trao đổi</Text>
                </Button>
              </View>
            </View>
          </>
        )
      }
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 840,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  requestHeader: {
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  requestCode: {
    fontFamily: fonts.medium,
    ...typography.caption,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
    includeFontPadding: false,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  hashtag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.orangeSoft,
  },
  hashtagText: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: colors.orange,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  budget: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  amount: {
    fontFamily: fonts.bold,
    ...typography.title,
    color: colors.orangeDark,
  },
  budgetNote: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  label: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.ink,
  },
  poster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
  },
  posterMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  reputation: {
    fontFamily: fonts.medium,
    ...typography.caption,
    color: colors.green,
  },
  budgetCaption: {
    fontFamily: fonts.medium,
    ...typography.caption,
    color: colors.muted,
  },
  total: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.orange,
  },
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  actionRow: {
    width: "100%",
    maxWidth: 808,
    alignSelf: "center",
    flexDirection: "row",
    gap: 10,
  },
  profileButton: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.tag,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  contactButton: {
    flex: 1.4,
    minWidth: 0,
    backgroundColor: colors.orangeDark,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 6,
  },
  profileButtonText: {
    fontFamily: fonts.bold,
    ...typography.secondary,
    color: colors.body,
  },
  buttonText: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.surface,
  },
});
