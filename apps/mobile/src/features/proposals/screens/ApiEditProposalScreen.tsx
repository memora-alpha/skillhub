import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Copy } from "@/components/feature-page";
import {
  FlowPage as FeaturePage,
  FlowSection as Panel,
} from "@/components/learning-flow";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
} from "@/features/connections";
import { useProposal, useProposalsApi } from "../hooks/use-proposals-api";
import { ApiProposalForm } from "../components/ApiProposalForm";
import { ProposalRecovery } from "../components/ProposalRecovery";
import type { Proposal, ProposalHints } from "../api/proposals-api";

export function ApiEditProposalScreen({ id }: Readonly<{ id: string }>) {
  const query = useProposal(id),
    api = useProposalsApi(),
    command = useConnectionCommand<Proposal>([
      ["proposals"],
      ["proposal", id],
      ["conversation-resource"],
    ]);
  const runtime = useConnections(),
    router = useRouter();
  const proposal = query.data;
  const original = useRef<number | undefined>(undefined);
  const [editorRevision, setEditorRevision] = useState(0);
  if (proposal && original.current === undefined)
    original.current = proposal.version;
  const changed = !!proposal && original.current !== proposal.version;
  const allowed =
    proposal?.status === "PENDING" && proposal.proposerId === runtime.userId;
  const finish = (result: Proposal) => {
    if (runtime.isCurrent())
      router.dismissTo({
        pathname: "/proposal/[id]",
        params: { id: result.id },
      });
  };
  const submit = async (hints: ProposalHints) => {
    if (
      !allowed ||
      query.error ||
      query.isFetching ||
      changed ||
      command.uncertain
    )
      return;
    const body = { ...hints, expectedVersion: original.current! };
    const result = await command.run(JSON.stringify({ id, ...body }), (key) =>
      api.update(id, body, key),
    );
    if (result) finish(result);
  };
  return (
    <FeaturePage
      title="Chỉnh sửa đề xuất"
      backBehavior="history"
      keyboardDismissMode="none"
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
        <Panel title="Cập nhật lời đề nghị">
          {!command.uncertain && <ConnectionFeedback error={command.error} />}
          {changed && (
            <>
              <Copy>
                Đề xuất đã thay đổi sang phiên bản mới. Nội dung bạn đang nhập
                được giữ lại để đối chiếu.
              </Copy>
              <Button
                variant="secondary"
                disabled={command.pending || command.uncertain}
                onPress={() => {
                  original.current = proposal.version;
                  setEditorRevision((v) => v + 1);
                }}
              >
                Mở nội dung phiên bản mới
              </Button>
            </>
          )}
          <ApiProposalForm
            key={`${proposal.id}:${editorRevision}`}
            proposal={proposal}
            pending={command.pending}
            locked={command.uncertain}
            disabled={!!query.error || query.isFetching || changed}
            onSubmit={submit}
          />
        </Panel>
      ) : (
        !query.isPending &&
        !query.error && (
          <EmptyState
            title="Không thể chỉnh sửa"
            description="Chỉ đề xuất bạn gửi và đang chờ phản hồi mới có thể sửa."
          />
        )
      )}
    </FeaturePage>
  );
}
