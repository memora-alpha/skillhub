import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { RefreshableScrollView as ScrollView } from "@/components/RefreshableScrollView";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { colors, fonts, typography } from "@/constants/theme";
import { useMockMessages } from "@/features/messages";
import { useMockProposals } from "../context/MockProposals";
import { ProposalCard } from "../components/ProposalCard";

const tabs = [
  { id: "received", label: "Đã nhận" },
  { id: "sent", label: "Đã gửi" },
  { id: "discussing", label: "Đang trao đổi" },
  { id: "accepted", label: "Đã chấp nhận" },
  { id: "closed", label: "Đã đóng" },
] as const;
type Tab = (typeof tabs)[number]["id"];
function selectedTab(value?: string): Tab {
  return tabs.find((item) => item.id === value)?.id ?? "received";
}
function Separator() {
  return <View style={{ height: 12 }} />;
}

export function ProposalsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { proposals } = useMockProposals();
  const { threads } = useMockMessages();
  const [tab, setTab] = useState<Tab>(selectedTab(params.tab));
  useEffect(() => {
    setTab(selectedTab(params.tab));
  }, [params.tab]);
  const filtered = proposals.filter((item) => {
    if (tab === "received")
      return item.direction === "received" && item.status === "PENDING";
    if (tab === "sent") return item.direction === "sent";
    if (tab === "discussing")
      return item.status === "ACCEPTED" && !!threads[item.id]?.length;
    if (tab === "accepted") return item.status === "ACCEPTED";
    return ["REJECTED", "WITHDRAWN", "EXPIRED"].includes(item.status);
  });
  return (
    <AppScreenLayout
      title="Đề xuất"
      selected="Tin nhắn"
      back={{ href: "/messages", label: "Quay lại tin nhắn" }}
    >
      {() => (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={Separator}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.heading}>
              <Text style={styles.title}>Kết nối để cùng học</Text>
              <Text style={styles.body}>
                Xem đề xuất cho yêu cầu học và lời mời trao đổi trực tiếp.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabs}
              >
                {tabs.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === item.id }}
                    onPress={() => {
                      setTab(item.id);
                      router.setParams({ tab: item.id });
                    }}
                    style={[styles.tab, tab === item.id && styles.activeTab]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        tab === item.id && styles.activeLabel,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {tab === "received" && !!filtered.length && (
                <Badge
                  label={`${filtered.length} đề xuất chờ phản hồi`}
                  variant="warning"
                />
              )}
              <Text style={styles.caption}>
                Đề xuất mẫu · Chấp nhận chỉ mở Chat, chưa giữ Credit.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="message"
              title="Chưa có đề xuất"
              description={
                tab === "sent"
                  ? "Tìm một yêu cầu học phù hợp để gửi đề xuất đầu tiên."
                  : "Đề xuất ở trạng thái này sẽ xuất hiện tại đây."
              }
              action="Khám phá yêu cầu học"
              onAction={() => router.navigate("/discover")}
            />
          }
          renderItem={({ item }) => (
            <ProposalCard
              proposal={item}
              onPress={() =>
                router.push({
                  pathname: "/proposal/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
        />
      )}
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  heading: { gap: 12, paddingBottom: 16 },
  title: { fontFamily: fonts.bold, ...typography.title, color: colors.ink },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  tabs: { gap: 6, paddingVertical: 4 },
  tab: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: colors.sand,
  },
  activeTab: {
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  tabText: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
  },
  activeLabel: { color: colors.brandHover },
});
