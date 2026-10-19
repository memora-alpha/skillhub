import { useRouter } from "expo-router";
import { FeaturePage, Copy } from "@/components/feature-page";
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

export function ApiCloseProposalScreen({
  id,
  action,
}: Readonly<{
  id: string;
  action?: string;
}>) {
  const query = useProposal(id),
    api = useProposalsApi(),
    command = useConnectionCommand<ProposalDecisionResult>();
  const runtime = useConnections(),
    router = useRouter();
  const proposal = query.data;
  const confirmLabel =
    action === "reject" ? "Xác nhận từ chối" : "Xác nhận rút đề xuất";
  const allowed =
    proposal?.status === "PENDING" &&
    (action === "reject"
      ? proposal.recipientId === runtime.userId
      : action === "withdraw" && proposal.proposerId === runtime.userId);
  const finish = (result: ProposalDecisionResult) => {
    if (runtime.isCurrent())
      router.dismissTo({
        pathname: "/proposal/[id]",
        params: { id: result.proposal.id },
      });
  };
  const close = async () => {
    if (
      !allowed ||
      (action !== "reject" && action !== "withdraw") ||
      query.isFetching ||
      command.uncertain
    )
      return;
    const result = await command.run(
      `${action}:${id}:${proposal.version}`,
      (key) => api.decide(id, action, proposal.version, key),
    );
    if (result) finish(result);
  };
  return (
    <FeaturePage
      title={action === "reject" ? "Từ chối đề xuất" : "Rút đề xuất"}
      demo={false}
      back={{ pathname: "/proposal/[id]", params: { id } }}
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      <ProposalRecovery command={command} onRecovered={finish} />
      {allowed ? (
        <>
          <ApiProposalSummary proposal={proposal} compact />
          <Copy>
            {action === "reject"
              ? "Bạn muốn từ chối đề xuất này? Các đề xuất khác giữ nguyên."
              : "Người nhận sẽ không thể chấp nhận đề xuất sau khi bạn rút."}
          </Copy>
          {!command.uncertain && <ConnectionFeedback error={command.error} />}
          <Button
            variant="craft"
            disabled={command.pending || query.isFetching || command.uncertain}
            onPress={() => {
              void close();
            }}
          >
            {command.pending ? "Đang xử lý..." : confirmLabel}
          </Button>
          <Button
            variant="secondary"
            disabled={command.pending}
            onPress={() => router.back()}
          >
            Giữ đề xuất
          </Button>
        </>
      ) : (
        !query.isPending &&
        !query.error && (
          <EmptyState
            title="Không thể đóng đề xuất"
            description="Kiểm tra trạng thái và quyền gửi/nhận của bạn."
          />
        )
      )}
    </FeaturePage>
  );
}
