import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/components/AppScreenLayout";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";
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
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.requestHeader}>
              <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.title}>
                  {request.title}
                </Text>
                <Badge label="Đang mở" variant="success" />
              </View>
              <View style={styles.tags}>
                {(detail?.hashtags ?? request.tags.map((tag) => `#${tag}`)).map(
                  (tag) => (
                    <View key={tag} style={styles.hashtag}>
                      <Text style={styles.hashtagText}>{tag}</Text>
                    </View>
                  ),
                )}
              </View>
              <View style={styles.meta}>
                <View style={styles.metaItem}>
                  <Icon name="clock" size={12} color={colors.muted} />
                  <Text style={styles.caption}>Đăng {request.created}</Text>
                </View>
                <Text style={styles.caption}>·</Text>
                <Text style={styles.caption}>
                  {request.sessions} buổi{detail ? ` · ${detail.duration}` : ""}
                </Text>
              </View>
            </View>
            <RequestDetailSections detail={detail} />
            <View style={styles.budget}>
              <View style={{ flex: 1 }}>
                <Text style={styles.caption}>Ngân sách trao đổi</Text>
                <Text style={styles.amount}>
                  {request.budget.split("/")[0]}
                  <Text style={styles.budgetNote}> / toàn lộ trình</Text>
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.caption}>Tổng dự kiến</Text>
                <Text style={styles.label}>{request.budget.split("/")[0]}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xem hồ sơ ${request.user}`}
              onPress={() => open(`Hồ sơ ${request.user}`)}
              style={styles.poster}
            >
              <Avatar name={request.user} size={48} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.label}>{request.user}</Text>
                <View style={styles.posterMeta}>
                  {detail ? (
                    <>
                      <Badge label={`${detail.reputation} Reputation`} />
                      <Text style={styles.caption}>{detail.memberSince}</Text>
                    </>
                  ) : (
                    <Text style={styles.caption}>
                      Thông tin hồ sơ đang được cập nhật.
                    </Text>
                  )}
                </View>
              </View>
              <Icon name="chevron" size={16} color={colors.mutedLight} />
            </Pressable>
            <View style={styles.actions}>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => open(`Hồ sơ ${request.user}`)}
              >
                Xem hồ sơ
              </Button>
              <Button style={{ flex: 1 }} onPress={() => open("Gửi Proposal")}>
                <Icon name="message" size={16} color={colors.white} />
                <Text style={styles.buttonText}>Liên hệ</Text>
              </Button>
            </View>
          </ScrollView>
        )
      }
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
  },
  requestHeader: { gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 27.5,
    color: colors.ink,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hashtag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: colors.brandLight,
  },
  hashtagText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.brand,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  budget: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.brandLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  amount: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.brand,
  },
  budgetNote: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  poster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
  },
  posterMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  actions: { flexDirection: "row", gap: 12, paddingBottom: 8 },
  buttonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
});
