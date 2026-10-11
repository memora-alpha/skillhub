import { useState } from "react";
import { Keyboard, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { ControlledInput } from "@/components/ControlledInput";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { colors, fonts, typography } from "@/constants/theme";
import { ProposalSummary } from "../components/ProposalSummary";
import { useMockProposals } from "../context/MockProposals";
import { rejectionFormSchema } from "../schemas/proposal-form";

export function CloseProposalScreen() {
  const router = useRouter();
  const { id, action } = useLocalSearchParams<{
    id: string;
    action?: string;
  }>();
  const { proposals, decide } = useMockProposals();
  const proposal = proposals.find((item) => item.id === id);
  const rejecting = action === "reject";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<{ note: string }>({
    resolver: zodResolver(rejectionFormSchema),
    defaultValues: { note: "" },
  });
  const detail = { pathname: "/proposal/[id]" as const, params: { id } };
  const allowed =
    !!proposal &&
    proposal.status === "PENDING" &&
    (rejecting
      ? proposal.direction === "received"
      : action === "withdraw" && proposal.direction === "sent");
  const close = (note?: string) => {
    if (!allowed || !decide(id, rejecting ? "REJECTED" : "WITHDRAWN", note)) {
      setError(
        "Đề xuất đã thay đổi. Hãy quay lại chi tiết để kiểm tra trạng thái.",
      );
      return;
    }
    Keyboard.dismiss();
    setDone(true);
  };
  return (
    <AppScreenLayout
      title={
        done ? "Đề xuất đã đóng" : rejecting ? "Từ chối đề xuất" : "Rút đề xuất"
      }
      selected="Tin nhắn"
      back={{ href: detail, label: "Quay lại chi tiết đề xuất" }}
    >
      {() =>
        !proposal || (!allowed && !done) ? (
          <EmptyState
            title="Không thể đóng đề xuất"
            description="Thao tác này chỉ áp dụng cho đề xuất đang chờ phản hồi và đúng người gửi hoặc người nhận."
            action="Xem lại chi tiết"
            onAction={() => router.dismissTo(detail)}
          />
        ) : (
          <KeyboardFormScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>
              {done
                ? rejecting
                  ? "Bạn đã từ chối đề xuất"
                  : "Bạn đã rút đề xuất"
                : rejecting
                  ? "Vì sao đề xuất chưa phù hợp?"
                  : "Bạn muốn rút lời đề nghị này?"}
            </Text>
            <ProposalSummary proposal={proposal} compact />
            {done ? (
              <>
                <FormNotice tone="success">
                  Đề xuất mẫu đã đóng. Bạn có thể xem lại trong danh sách Đã
                  đóng.
                </FormNotice>
                {!!proposal.localDecisionNote && (
                  <>
                    <Text style={styles.heading}>Lý do từ chối</Text>
                    <Text selectable style={styles.body}>
                      {proposal.localDecisionNote}
                    </Text>
                  </>
                )}
                <Button
                  onPress={() =>
                    router.dismissTo({
                      pathname: "/proposals",
                      params: { tab: "closed" },
                    })
                  }
                >
                  Về danh sách đã đóng
                </Button>
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  {rejecting
                    ? "Chia sẻ lý do để người gửi hiểu lựa chọn của bạn. Chỉ đề xuất này bị đóng; các đề xuất khác giữ nguyên."
                    : "Người nhận sẽ không thể chấp nhận đề xuất đã rút. Bạn vẫn xem được lịch sử và có thể gửi một đề xuất mới sau đó."}
                </Text>
                {rejecting && (
                  <ControlledInput
                    control={control}
                    name="note"
                    label="Lý do từ chối"
                    required
                    multiline
                    textAlignVertical="top"
                    maxLength={1000}
                    placeholder="Ví dụ: Khung giờ chưa phù hợp với lịch của mình..."
                  />
                )}
                {!!error && <FormNotice tone="error">{error}</FormNotice>}
                <Button
                  onPress={() => {
                    if (rejecting)
                      void handleSubmit(({ note }) => close(note))();
                    else close();
                  }}
                >
                  {rejecting ? "Xác nhận từ chối" : "Xác nhận rút đề xuất"}
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => router.dismissTo(detail)}
                >
                  Giữ đề xuất & quay lại
                </Button>
              </>
            )}
            <Text style={styles.caption}>
              Dữ liệu mẫu · Lý do chỉ lưu trong phiên, chưa gửi thông báo đến
              người nhận.
            </Text>
          </KeyboardFormScrollView>
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
  title: { fontFamily: fonts.bold, ...typography.title, color: colors.ink },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
});
