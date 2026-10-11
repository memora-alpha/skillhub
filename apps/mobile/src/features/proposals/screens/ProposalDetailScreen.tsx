import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { colors, fonts, typography } from "@/constants/theme";
import { learningRequests } from "@/features/discovery";
import { ProposalSummary } from "../components/ProposalSummary";
import { useMockProposals } from "../context/MockProposals";

export function ProposalDetailScreen() {
  const router = useRouter();
  const { id, updated } = useLocalSearchParams<{
    id: string;
    updated?: string;
  }>();
  const { proposals, decide } = useMockProposals();
  const proposal = proposals.find((item) => item.id === id);
  const [error, setError] = useState<string | null>(null);
  const otherAccepted =
    proposal?.requestId !== undefined &&
    proposals.some(
      (item) =>
        item.id !== id &&
        item.requestId === proposal.requestId &&
        item.status === "ACCEPTED",
    );
  const request = learningRequests.find(
    (item) => item.id === proposal?.requestId,
  );
  const accept = () => {
    if (!decide(id, "ACCEPTED")) {
      setError(
        "Đề xuất đã thay đổi hoặc yêu cầu đã có kết nối được chấp nhận. Hãy xem lại danh sách.",
      );
      return;
    }
    router.push({ pathname: "/chat/[proposalId]", params: { proposalId: id } });
  };
  const closed =
    proposal && ["REJECTED", "WITHDRAWN", "EXPIRED"].includes(proposal.status);
  return (
    <AppScreenLayout
      title="Chi tiết đề xuất"
      selected="Tin nhắn"
      back={{ href: "/proposals", label: "Quay lại đề xuất" }}
    >
      {() =>
        !proposal ? (
          <EmptyState
            title="Không tìm thấy đề xuất"
            description="Đề xuất không có trong phiên hiện tại. Hãy quay lại danh sách để chọn một đề xuất khác."
            action="Về danh sách đề xuất"
            onAction={() => router.dismissTo("/proposals")}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {updated === "1" && (
              <FormNotice tone="success">
                Đã lưu thay đổi đề xuất trong phiên hiện tại.
              </FormNotice>
            )}
            <ProposalSummary proposal={proposal} />
            {!!proposal.localDecisionNote && (
              <View style={styles.section}>
                <Text style={styles.heading}>Lý do từ chối</Text>
                <Text selectable style={styles.body}>
                  {proposal.localDecisionNote}
                </Text>
              </View>
            )}
            {proposal.status === "PENDING" && (
              <Text style={styles.body}>
                Credit, số buổi và khung giờ là gợi ý ban đầu. Chấp nhận mở Chat
                để hai người thống nhất cách học.
              </Text>
            )}
            {closed && (
              <Text style={styles.body}>
                {proposal.status === "EXPIRED"
                  ? "Đề xuất mẫu này đã hết hạn. Bạn có thể gửi một lời mời mới từ hồ sơ công khai."
                  : proposal.status === "WITHDRAWN"
                    ? "Bạn đã rút đề xuất này. Lịch sử vẫn được giữ trong danh sách Đã đóng."
                    : "Đề xuất đã bị từ chối. Những đề xuất khác không bị đóng theo."}
              </Text>
            )}
            <Button
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/user/[id]",
                  params: { id: proposal.partnerId },
                })
              }
            >
              Xem hồ sơ công khai
            </Button>
            {!!request && (
              <Button
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/request/[id]",
                    params: { id: request.id },
                  })
                }
              >
                Xem yêu cầu học gốc
              </Button>
            )}
            {!!error && <FormNotice tone="error">{error}</FormNotice>}
            {proposal.status === "PENDING" &&
              proposal.direction === "received" && (
                <>
                  {otherAccepted && (
                    <Text style={styles.body}>
                      Yêu cầu này đã có một đề xuất được chấp nhận.
                    </Text>
                  )}
                  <Button disabled={otherAccepted} onPress={accept}>
                    Chấp nhận & mở Chat
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/proposal/[id]/close",
                        params: { id, action: "reject" },
                      })
                    }
                  >
                    Từ chối đề xuất
                  </Button>
                </>
              )}
            {proposal.status === "PENDING" && proposal.direction === "sent" && (
              <>
                <Button
                  onPress={() =>
                    router.push({
                      pathname: "/proposal/[id]/edit",
                      params: { id },
                    })
                  }
                >
                  Chỉnh sửa đề xuất
                </Button>
                <Button
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/proposal/[id]/close",
                      params: { id, action: "withdraw" },
                    })
                  }
                >
                  Rút đề xuất
                </Button>
              </>
            )}
            {proposal.status === "ACCEPTED" && (
              <>
                <FormNotice tone="success">
                  Đã kết nối. Hai người có thể trao đổi về lộ trình và lịch học
                  trong Chat.
                </FormNotice>
                <Button
                  onPress={() =>
                    router.push({
                      pathname: "/chat/[proposalId]",
                      params: { proposalId: id },
                    })
                  }
                >
                  Tiếp tục trao đổi
                </Button>
              </>
            )}
            {closed && proposal.direction === "sent" && (
              <Button
                onPress={() =>
                  router.push({
                    pathname: "/send-proposal",
                    params: request
                      ? { requestId: request.id }
                      : { userId: proposal.partnerId },
                  })
                }
              >
                Gửi đề xuất mới
              </Button>
            )}
            <Text style={styles.caption}>
              Dữ liệu mẫu trong phiên · Chấp nhận chưa tạo Session hoặc tạm giữ
              Credit.
            </Text>
          </ScrollView>
        )
      }
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
    gap: 16,
  },
  section: {
    gap: 8,
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 8,
  },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
});
