import { useRouter } from "expo-router";
import { Copy, FeaturePage, RouteButton } from "@/components/feature-page";
import { EmptyState } from "@/components/EmptyState";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
} from "@/features/connections";
import { useProposal, useProposalsApi } from "../hooks/use-proposals-api";
import { ApiProposalSummary } from "../components/ApiProposalSummary";
import { ProposalRecovery } from "../components/ProposalRecovery";
import { ProposalAcceptActions } from "../components/ProposalAcceptActions";
import type { ProposalDecisionResult } from "../api/proposals-api";

export function ApiProposalDetailScreen({ id }: Readonly<{ id: string }>) {
  const router = useRouter();
  const query = useProposal(id);
  const api = useProposalsApi();
  const { userId, isCurrent } = useConnections();
  const command = useConnectionCommand<ProposalDecisionResult>();
  const proposal = query.data;
  const openConversation = (result: ProposalDecisionResult) => {
    if (result.conversation && isCurrent())
      router.replace({
        pathname: "/chat/[proposalId]",
        params: { proposalId: result.conversation.id, mode: "api" },
      });
  };
  const accept = async (
    proposalVersion: number,
    expectedRequestVersion?: number,
  ) => {
    if (
      proposal?.status !== "PENDING" ||
      proposal.recipientId !== userId ||
      query.isFetching ||
      command.uncertain ||
      (proposal.sourceType === "LEARNING_REQUEST" &&
        expectedRequestVersion === undefined) ||
      (proposal.sourceType === "DIRECT_SEARCH" &&
        expectedRequestVersion !== undefined) ||
      proposalVersion !== proposal.version
    )
      return;
    const result = await command.run(
      `accept:${id}:${proposal.version}:${expectedRequestVersion ?? "direct"}`,
      (key) =>
        api.decide(id, "accept", proposalVersion, key, expectedRequestVersion),
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
          {proposal.status === "PENDING" && (
            <Copy muted>
              Bước 1 · Kết nối. Đồng ý đề xuất sẽ mở Chat; nội dung học, lịch và
              Credit được thống nhất sau.
            </Copy>
          )}
          {!command.uncertain && <ConnectionFeedback error={command.error} />}
          {!command.uncertain &&
            proposal.status === "PENDING" &&
            proposal.recipientId === userId && (
              <>
                <ProposalAcceptActions
                  proposal={proposal}
                  disabled={command.pending || query.isFetching}
                  onAccept={accept}
                />
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
