import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { InfoModal } from "@/components/InfoModal";
import { colors, fonts, signedInChrome, typography } from "@/constants/theme";
import { useMockMessages } from "@/features/messages";
import { useMockProposals } from "../context/MockProposals";
import { ProposalCard, proposalStatusLabels } from "../components/ProposalCard";

const tabs = [
  { id: "received", label: "Đã nhận" },
  { id: "sent", label: "Đã gửi" },
  { id: "discussing", label: "Đang trao đổi" },
  { id: "accepted", label: "Đã chấp nhận" },
  { id: "closed", label: "Đã đóng" },
] as const;
type Tab = (typeof tabs)[number]["id"];
function Separator() {
  return <View style={{ height: 12 }} />;
}

export function ProposalsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { proposals, decide } = useMockProposals();
  const { threads } = useMockMessages();
  const [tab, setTab] = useState<Tab>(
    params.tab === "sent" ? "sent" : "received",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (params.tab === "sent") setTab("sent");
  }, [params.tab]);
  const selected = proposals.find((item) => item.id === selectedId);
  const filtered = proposals.filter((item) => {
    if (tab === "received")
      return item.direction === "received" && item.status === "PENDING";
    if (tab === "sent") return item.direction === "sent";
    if (tab === "discussing")
      return item.status === "ACCEPTED" && !!threads[item.id]?.length;
    if (tab === "accepted") return item.status === "ACCEPTED";
    return ["REJECTED", "WITHDRAWN", "EXPIRED"].includes(item.status);
  });
  const otherAccepted =
    !!selected?.requestId &&
    proposals.some(
      (item) =>
        item.id !== selected.id &&
        item.requestId === selected.requestId &&
        item.status === "ACCEPTED",
    );
  const openChat = (id: string) => {
    setSelectedId(null);
    router.push({ pathname: "/chat/[proposalId]", params: { proposalId: id } });
  };
  const act = (status: "ACCEPTED" | "REJECTED" | "WITHDRAWN") => {
    if (!selected) return;
    if (!decide(selected.id, status)) {
      setError(
        "Đề xuất đã thay đổi hoặc yêu cầu này đã có đề xuất được chấp nhận.",
      );
      return;
    }
    if (status === "ACCEPTED") openChat(selected.id);
    else setSelectedId(null);
  };
  return (
    <AppScreenLayout
      title="Đề xuất"
      selected="Tin nhắn"
      back={{ href: "/messages", label: "Quay lại tin nhắn" }}
    >
      {() => (
        <>
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
                  Xem đề xuất nhận được và theo dõi lời mời đã gửi.
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
                      onPress={() => setTab(item.id)}
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
                  <View style={styles.summary}>
                    <Text style={styles.label}>Yêu cầu học của bạn</Text>
                    <Text style={styles.body}>
                      Muốn học React từ cơ bản đến nâng cao
                    </Text>
                    <Badge
                      label={`${filtered.length} đề xuất chờ phản hồi`}
                      variant="warning"
                    />
                  </View>
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
                onPress={() => {
                  setError(null);
                  setSelectedId(item.id);
                }}
              />
            )}
          />
          <InfoModal
            title={selected ? "Chi tiết đề xuất" : null}
            onClose={() => setSelectedId(null)}
            confirmLabel={selected?.status === "ACCEPTED" ? "Mở Chat" : "Đóng"}
            onConfirm={
              selected?.status === "ACCEPTED"
                ? () => openChat(selected.id)
                : undefined
            }
          >
            {!!selected && (
              <>
                <View style={styles.person}>
                  <Avatar
                    name={selected.partner}
                    userId={selected.partnerId}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{selected.partner}</Text>
                    <Text style={styles.caption}>{selected.skill}</Text>
                  </View>
                </View>
                <Badge
                  label={proposalStatusLabels[selected.status]}
                  variant={
                    selected.status === "ACCEPTED" ? "success" : "warning"
                  }
                />
                <Text style={styles.label}>{selected.requestTitle}</Text>
                <Text selectable style={styles.body}>
                  {selected.message}
                </Text>
                <Text selectable style={styles.body}>
                  {selected.credit} CR gợi ý · {selected.sessions} buổi dự kiến
                </Text>
                {!!selected.schedule && (
                  <Text selectable style={styles.body}>
                    {selected.schedule}
                  </Text>
                )}
                <Button
                  variant="secondary"
                  onPress={() => {
                    setSelectedId(null);
                    router.push({
                      pathname: "/user/[id]",
                      params: { id: selected.partnerId },
                    });
                  }}
                >
                  Xem hồ sơ công khai
                </Button>
                {!!error && <FormNotice tone="error">{error}</FormNotice>}
                {selected.status === "PENDING" &&
                  selected.direction === "received" && (
                    <>
                      <Text style={styles.caption}>
                        {otherAccepted
                          ? "Yêu cầu này đã có đề xuất được chấp nhận. Không thể mở thêm một kết nối cho cùng yêu cầu."
                          : "Chấp nhận để trao đổi về lộ trình và lịch học. Credit chưa được tạm giữ."}
                      </Text>
                      <Button
                        disabled={otherAccepted}
                        onPress={() => act("ACCEPTED")}
                      >
                        Chấp nhận & mở Chat
                      </Button>
                      <Button
                        variant="secondary"
                        onPress={() => act("REJECTED")}
                      >
                        Từ chối đề xuất
                      </Button>
                    </>
                  )}
                {selected.status === "PENDING" &&
                  selected.direction === "sent" && (
                    <Button
                      variant="secondary"
                      onPress={() => act("WITHDRAWN")}
                    >
                      Rút đề xuất
                    </Button>
                  )}
              </>
            )}
          </InfoModal>
        </>
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
  label: { fontFamily: fonts.semibold, ...typography.body, color: colors.ink },
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
  summary: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: signedInChrome.surface,
    gap: 8,
  },
  person: { flexDirection: "row", alignItems: "center", gap: 12 },
});
