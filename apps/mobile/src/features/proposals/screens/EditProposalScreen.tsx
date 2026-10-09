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
import {
  proposalFormSchema,
  type ProposalFormValues,
} from "../schemas/proposal-form";
import type { DemoProposal } from "../mocks/proposals";

export function EditProposalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { proposals } = useMockProposals();
  const proposal = proposals.find((item) => item.id === id);
  return (
    <AppScreenLayout
      title="Chỉnh sửa đề xuất"
      selected="Tin nhắn"
      back={{
        href: { pathname: "/proposal/[id]", params: { id } },
        label: "Quay lại chi tiết đề xuất",
      }}
    >
      {() =>
        !proposal ||
        proposal.direction !== "sent" ||
        proposal.status !== "PENDING" ? (
          <EmptyState
            title="Không thể chỉnh sửa"
            description="Chỉ đề xuất bạn đã gửi và đang chờ phản hồi mới có thể sửa. Hãy kiểm tra trạng thái hiện tại."
            action="Về danh sách đề xuất"
            onAction={() => router.dismissTo("/proposals")}
          />
        ) : (
          <EditProposalForm key={proposal.id} proposal={proposal} />
        )
      }
    </AppScreenLayout>
  );
}
function EditProposalForm({ proposal }: { proposal: DemoProposal }) {
  const router = useRouter();
  const { update } = useMockProposals();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      message: proposal.message,
      credit: proposal.credit,
      sessions: String(proposal.sessions),
      schedule: proposal.schedule,
    },
  });
  const detail = {
    pathname: "/proposal/[id]" as const,
    params: { id: proposal.id },
  };
  const save = handleSubmit((values) => {
    if (
      !update(proposal.id, { ...values, sessions: Number(values.sessions) })
    ) {
      setError(
        "Đề xuất đã thay đổi, không còn ở trạng thái chờ phản hồi. Hãy xem lại chi tiết.",
      );
      return;
    }
    Keyboard.dismiss();
    router.dismissTo({ ...detail, params: { ...detail.params, updated: "1" } });
  });
  return (
    <KeyboardFormScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cập nhật lời đề nghị của bạn</Text>
      <ProposalSummary proposal={proposal} compact />
      <Text style={styles.body}>
        Bạn có thể đổi nội dung và các gợi ý trước khi người nhận phản hồi.
      </Text>
      <ControlledInput
        control={control}
        name="message"
        label="Bạn sẽ giúp người học như thế nào?"
        required
        multiline
        textAlignVertical="top"
        maxLength={1000}
      />
      <ControlledInput
        control={control}
        name="credit"
        label="Credit gợi ý cho toàn lộ trình"
        required
        keyboardType="decimal-pad"
      />
      <ControlledInput
        control={control}
        name="sessions"
        label="Số buổi dự kiến"
        required
        keyboardType="number-pad"
      />
      <ControlledInput
        control={control}
        name="schedule"
        label="Khung giờ đề xuất"
        hint="Khung giờ tham khảo, chưa phải lịch được xác nhận."
      />
      {!!error && <FormNotice tone="error">{error}</FormNotice>}
      <Button
        disabled={!isDirty}
        onPress={() => {
          void save();
        }}
      >
        Lưu thay đổi
      </Button>
      <Button variant="secondary" onPress={() => router.dismissTo(detail)}>
        Hủy chỉnh sửa
      </Button>
      <Text style={styles.caption}>
        Thay đổi được lưu trong phiên hiện tại. Credit và số buổi vẫn là gợi ý.
      </Text>
    </KeyboardFormScrollView>
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
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
});
