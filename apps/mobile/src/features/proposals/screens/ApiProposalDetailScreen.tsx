import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Copy, RouteButton } from "@/components/feature-page";
import { FlowPage as FeaturePage } from "@/components/learning-flow";
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
  const command = useConnectionCommand<ProposalDecisionResult>([
    ["proposals"],
    ["proposal", id],
    ["conversation-resource"],
    { key: ["conversations"], exact: true },
  ]);
  const proposal = query.data;
  const { closeAction } = useLocalSearchParams<{ closeAction?: string }>();
  const [closing, setClosing] = useState<"reject" | "withdraw" | undefined>(
    closeAction === "reject" || closeAction === "withdraw"
      ? closeAction
      : undefined,
  );
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
      query.error ||
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
    <FeaturePage
      title="Chi tiết đề xuất"
      backBehavior="history"
      back={{
        pathname: "/proposals",
        params: { tab: proposal?.proposerId === userId ? "sent" : "received" },
      }}
      demo={false}
    >
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
            <FormNotice tone="info">
              Chấp nhận để trò chuyện và cùng xây dựng lộ trình. Bạn chưa cần
              đặt lịch hoặc tạm giữ Credit.
            </FormNotice>
          )}
          {!command.uncertain && <ConnectionFeedback error={command.error} />}
          {!command.uncertain &&
            proposal.status === "PENDING" &&
            proposal.recipientId === userId && (
              <>
                <ProposalAcceptActions
                  proposal={proposal}
                  disabled={
                    command.pending || query.isFetching || !!query.error
                  }
                  onAccept={accept}
                />
                <Button
                  variant="secondary"
                  disabled={
                    command.pending || query.isFetching || !!query.error
                  }
                  onPress={() => setClosing("reject")}
                >
                  Từ chối đề xuất
                </Button>
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
                <Button
                  variant="secondary"
                  disabled={command.pending || query.isFetching}
                  onPress={() => setClosing("withdraw")}
                >
                  Rút đề xuất
                </Button>
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
          {closing &&
            (closing === "reject"
              ? proposal.recipientId === userId
              : proposal.proposerId === userId) &&
            proposal.status === "PENDING" &&
            !command.uncertain && (
              <>
                <Copy>
                  {closing === "reject"
                    ? "Từ chối đề xuất này?"
                    : "Rút đề xuất này? Người nhận sẽ không thể chấp nhận sau khi bạn rút."}
                </Copy>
                <Button
                  disabled={
                    command.pending || query.isFetching || !!query.error
                  }
                  onPress={() => {
                    const action = closing;
                    void command
                      .run(`${action}:${id}:${proposal.version}`, (key) =>
                        api.decide(id, action, proposal.version, key),
                      )
                      .then((result) => {
                        if (result) setClosing(undefined);
                      });
                  }}
                >
                  Xác nhận {closing === "reject" ? "từ chối" : "rút đề xuất"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={command.pending}
                  onPress={() => setClosing(undefined)}
                >
                  Giữ đề xuất
                </Button>
              </>
            )}
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
