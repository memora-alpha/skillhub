import { useRouter } from "expo-router";
import { Panel, Copy } from "@/components/feature-page";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import {
  useConnections,
  useParticipantName,
  useCatalogName,
} from "@/features/connections";
import type { Proposal } from "../api/proposals-api";
import { proposalStatusLabels } from "../constants/proposal-status";

export function ApiProposalSummary({
  proposal,
  compact = false,
}: Readonly<{
  proposal: Proposal;
  compact?: boolean;
}>) {
  const router = useRouter();
  const { userId } = useConnections();
  const sent = proposal.proposerId === userId;
  const partnerId = sent ? proposal.recipientId : proposal.proposerId;
  const partner = useParticipantName(partnerId);
  const skill = useCatalogName(proposal.skillId);
  const statusVariant = proposal.status === "PENDING" ? "warning" : "default";
  const oneWayLabel = sent ? "Tôi muốn dạy bạn" : "Người gửi muốn dạy bạn";
  const exchangeLabel =
    proposal.exchangeTypeHint === "TWO_WAY" ? "Trao đổi" : oneWayLabel;
  return (
    <Panel title={skill.data ?? "Đề xuất trao đổi"}>
      <Copy>
        {sent ? "Gửi tới" : "Nhận từ"} {partner.data ?? "Thành viên SkillHub"}
      </Copy>
      <Badge
        label={proposalStatusLabels[proposal.status]}
        variant={proposal.status === "ACCEPTED" ? "success" : statusVariant}
      />
      <Copy>
        {proposal.sourceType === "DIRECT_SEARCH"
          ? "Lời mời trực tiếp"
          : "Phản hồi yêu cầu học"}{" "}
      </Copy>
      <Copy>{proposal.message}</Copy>
      {!compact && (
        <>
          {proposal.exchangeTypeHint && <Copy>Gợi ý: {exchangeLabel}</Copy>}
          {proposal.proposedCredit !== null && (
            <Copy>Credit gợi ý: {proposal.proposedCredit}</Copy>
          )}
          {proposal.initialSessionCount !== null && (
            <Copy>Số buổi gợi ý: {proposal.initialSessionCount}</Copy>
          )}
          {proposal.proposedDurationMinutes !== null && (
            <Copy>
              Thời lượng gợi ý: {proposal.proposedDurationMinutes} phút
            </Copy>
          )}
          {proposal.candidateSlots && (
            <Copy>Lịch rảnh gợi ý: {proposal.candidateSlots}</Copy>
          )}
          <Copy muted>
            Hết hạn: {new Date(proposal.expiresAt).toLocaleString("vi-VN")}.
          </Copy>
          {proposal.learningRequestId && (
            <Button
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/request/[id]",
                  params: { id: proposal.learningRequestId! },
                })
              }
            >
              Xem yêu cầu học
            </Button>
          )}
          <Button
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/profiles/[userId]",
                params: { userId: partnerId },
              })
            }
          >
            Xem hồ sơ
          </Button>
        </>
      )}
    </Panel>
  );
}
