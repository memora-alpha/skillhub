import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/components/AppScreenLayout";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";
import { sessionDetails } from "../mocks/sessionDetails";

export function SessionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const session = sessionDetails.find((item) => item.id === id);
  return (
    <AppScreenLayout
      title="Chi tiết buổi học"
      selected="Lịch học"
      back={{ href: "/calendar", label: "Quay lại lịch học" }}
    >
      {(open) =>
        !session ? (
          <EmptyState
            icon="calendar"
            title="Không tìm thấy buổi học"
            description="Buổi học này không có trong dữ liệu demo."
            action="Quay lại lịch học"
            onAction={() => router.dismissTo("/calendar")}
          />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
          >
            <View style={styles.card}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={styles.title}>
                  {session.detailTitle}
                </Text>
                <Badge label="Sắp tới" variant="warning" />
              </View>
              <View style={styles.grid}>
                {[
                  { label: "Ngày", value: session.date },
                  { label: "Giờ", value: session.timeRange },
                  {
                    label: "Thời lượng",
                    value: `${session.durationMinutes} phút`,
                  },
                  { label: "Credit", value: session.credit },
                ].map((item) => (
                  <View key={item.label} style={styles.cell}>
                    <Text style={styles.caption}>{item.label}</Text>
                    <Text style={styles.value}>{item.value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.partner}>
                <Avatar name={session.partner} size={40} />
                <View>
                  <Text style={styles.value}>{session.partner}</Text>
                  <Text style={styles.caption}>{session.partnerRole}</Text>
                </View>
              </View>
            </View>
            <View style={styles.actions}>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => open("Thay đổi lịch học")}
              >
                Thay đổi lịch
              </Button>
              <Button style={{ flex: 1 }} onPress={() => open("Phòng học")}>
                Vào phòng học
              </Button>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => open("Báo cáo vấn đề")}
              style={styles.report}
            >
              <Icon name="flag" size={14} color={colors.error} />
              <Text style={styles.reportText}>Báo cáo vấn đề</Text>
            </Pressable>
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
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 16,
    lineHeight: 26,
    color: colors.ink,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: {
    flexBasis: "45%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.cream,
    gap: 2,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  value: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  partner: { flexDirection: "row", alignItems: "center", gap: 12 },
  actions: { flexDirection: "row", gap: 12 },
  report: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
  },
  reportText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.error,
  },
});
