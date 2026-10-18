import { useState } from "react";
import { useRouter } from "expo-router";
import {
  FeaturePage,
  Copy,
  RouteButton,
  Panel,
} from "@/components/feature-page";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
} from "@/features/connections";
import { useProposal, useProposalsApi } from "../hooks/use-proposals-api";
import { ApiProposalSummary } from "../components/ApiProposalSummary";
import { ProposalRecovery } from "../components/ProposalRecovery";
import type { ProposalDecisionResult } from "../api/proposals-api";

export function ApiProposalDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const query = useProposal(id);
  const api = useProposalsApi();
  const { userId, isCurrent } = useConnections();
  const command = useConnectionCommand<ProposalDecisionResult>();
  const [confirmationVersion, setConfirmationVersion] = useState<number | null>(
    null,
  );
  const proposal = query.data;
  const openConversation = (result: ProposalDecisionResult) => {
    if (result.conversation && isCurrent())
      router.replace({
        pathname: "/chat/[proposalId]",
        params: { proposalId: result.conversation.id, mode: "api" },
      });
  };
  const accept = async () => {
    if (
      !proposal ||
      proposal.status !== "PENDING" ||
      proposal.recipientId !== userId ||
      query.isFetching ||
      command.uncertain ||
      confirmationVersion !== proposal.version
    )
      return;
    const result = await command.run(
      `accept:${id}:${proposal.version}`,
      (key) => api.decide(id, "accept", proposal.version, key),
    );
    if (result) openConversation(result);
  };
  return (
    <FeaturePage title="Chi tiết đề xuất" back="/proposals" demo={false}>
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      <ProposalRecovery command={command} onRecovered={openConversation} />
      {proposal && (
        <>
          <ApiProposalSummary proposal={proposal} />
          {!command.uncertain && <ConnectionFeedback error={command.error} />}
          {!command.uncertain &&
            proposal.status === "PENDING" &&
            proposal.recipientId === userId && (
              <>
                <Button
                  variant="craft"
                  disabled={command.pending || query.isFetching}
                  onPress={() => setConfirmationVersion(proposal.version)}
                >
                  Chấp nhận đề xuất
                </Button>
                {confirmationVersion === proposal.version && (
                  <Panel title="Bắt đầu trao đổi với người gửi?">
                    <Copy>
                      Chấp nhận chỉ mở Chat để thương lượng lộ trình và lịch
                      học, chưa giữ Credit.
                    </Copy>
                    <Button
                      disabled={command.pending || query.isFetching}
                      onPress={() => {
                        void accept();
                      }}
                    >
                      {command.pending
                        ? "Đang chấp nhận..."
                        : "Xác nhận chấp nhận"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={command.pending}
                      onPress={() => setConfirmationVersion(null)}
                    >
                      Quay lại
                    </Button>
                  </Panel>
                )}
                <RouteButton
                  secondary
                  href={{
                    pathname: "/proposal/[id]/close",
                    params: { id, action: "reject" },
                  }}
                >
                  Từ chối đề xuất
                </RouteButton>
              </>
            )}
          {!command.uncertain &&
            proposal.status === "PENDING" &&
            proposal.proposerId === userId && (
              <>
                <RouteButton
                  href={{ pathname: "/proposal/[id]/edit", params: { id } }}
                >
                  Chỉnh sửa đề xuất
                </RouteButton>
                <RouteButton
                  secondary
                  href={{
                    pathname: "/proposal/[id]/close",
                    params: { id, action: "withdraw" },
                  }}
                >
                  Rút đề xuất
                </RouteButton>
              </>
            )}
          {proposal.status === "ACCEPTED" &&
            (proposal.conversationId ? (
              <RouteButton
                href={{
                  pathname: "/chat/[proposalId]",
                  params: { proposalId: proposal.conversationId, mode: "api" },
                }}
              >
                Mở cuộc trao đổi
              </RouteButton>
            ) : (
              <RouteButton href="/messages">
                Tìm cuộc trao đổi trong Tin nhắn
              </RouteButton>
            ))}
        </>
      )}
      {!query.isPending && !proposal && !query.error && (
        <EmptyState
          title="Không tìm thấy đề xuất"
          description="Kiểm tra lại đề xuất của bạn."
        />
      )}
    </FeaturePage>
  );
}
