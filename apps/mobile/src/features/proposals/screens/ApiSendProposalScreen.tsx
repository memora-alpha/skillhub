import { useRouter, type Href } from "expo-router";
import { FeaturePage, Copy, Panel } from "@/components/feature-page";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { useRequestDetail } from "@/features/learning-requests";
import { usePublicSkill } from "@/features/skills";
import {
  useConnections,
  useConnectionCommand,
  ConnectionFeedback,
} from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useProposalsApi } from "../hooks/use-proposals-api";
import { ApiProposalForm } from "../components/ApiProposalForm";
import type {
  Proposal,
  ProposalHints,
  ProposalInput,
} from "../api/proposals-api";
function proposalBack(requestId?: string, userId?: string): Href {
  if (requestId)
    return { pathname: "/request/[id]", params: { id: requestId } };
  if (userId) return { pathname: "/profiles/[userId]", params: { userId } };
  return "/discover";
}
function proposalAccess(
  request: ReturnType<typeof useRequestDetail>["data"],
  direct: boolean,
  hasSkill: boolean,
  userId: string | undefined,
  currentUserId: string | null | undefined,
) {
  const publicRequest = request && "owner" in request ? request : undefined;
  const requestAllowed =
    !!publicRequest &&
    publicRequest.status === "OPEN" &&
    publicRequest.owner.id !== currentUserId;
  return {
    publicRequest,
    allowed: direct ? hasSkill && userId !== currentUserId : requestAllowed,
  };
}

export function ApiSendProposalScreen({
  requestId,
  userId,
  sharingSkillId,
}: Readonly<{
  requestId?: string;
  userId?: string;
  sharingSkillId?: string;
}>) {
  const router = useRouter();
  const runtime = useConnections();
  const requestQuery = useRequestDetail(requestId);
  const skillQuery = usePublicSkill(
    uuid.safeParse(userId).success ? userId! : null,
    uuid.safeParse(sharingSkillId).success ? sharingSkillId! : null,
  );
  const api = useProposalsApi();
  const command = useConnectionCommand<Proposal>();
  const direct = !requestId;
  const { publicRequest, allowed } = proposalAccess(
    requestQuery.data,
    direct,
    !!skillQuery.data,
    userId,
    runtime.userId,
  );
  const query = direct ? skillQuery : requestQuery;
  const valid = direct
    ? uuid.safeParse(userId).success && uuid.safeParse(sharingSkillId).success
    : uuid.safeParse(requestId).success;
  const openResult = (result: Proposal | undefined) => {
    if (result && runtime.isCurrent())
      router.replace({ pathname: "/proposal/[id]", params: { id: result.id } });
  };
  const submit = async (hints: ProposalHints) => {
    if (!allowed || query.isFetching || command.uncertain) return;
    const body: ProposalInput = direct
      ? {
          ...hints,
          sourceType: "DIRECT_SEARCH",
          recipientSharingSkillId: sharingSkillId!,
        }
      : {
          ...hints,
          sourceType: "LEARNING_REQUEST",
          learningRequestId: requestId!,
        };
    const result = await command.run(JSON.stringify(body), (key) =>
      api.create(body, key),
    );
    openResult(result);
  };
  return (
    <FeaturePage
      title={direct ? "Lời mời trao đổi" : "Gửi đề xuất"}
      demo={false}
      keyboardDismissMode="none"
      back={proposalBack(requestId, userId)}
      backBehavior="history"
    >
      {valid && (
        <ConnectionFeedback
          loading={query.isLoading}
          error={query.error}
          retry={query.refetch}
        />
      )}
      {command.uncertain && (
        <Panel title="Kiểm tra lần gửi trước">
          <FormNotice tone="info">
            Chưa xác định được đề xuất đã gửi thành công hay chưa. Nội dung được
            giữ nguyên để kiểm tra lại, tránh tạo đề xuất trùng.
          </FormNotice>
          <ConnectionFeedback error={command.originalError} />
          {command.error !== command.originalError && (
            <ConnectionFeedback error={command.error} />
          )}
          <Button
            variant="craft"
            disabled={command.pending || !runtime.isCurrent()}
            onPress={() => {
              void command.retry().then(openResult);
            }}
          >
            {command.pending
              ? "Đang kiểm tra..."
              : "Kiểm tra lại lần gửi trước"}
          </Button>
          <Button
            variant="secondary"
            disabled={command.pending}
            onPress={() =>
              router.push({ pathname: "/proposals", params: { tab: "sent" } })
            }
          >
            Xem đề xuất đã gửi
          </Button>
        </Panel>
      )}
      {allowed ? (
        <Panel
          title={direct ? skillQuery.data?.skill.name : publicRequest?.title}
        >
          {!direct && (
            <Copy>
              Gửi tới {publicRequest?.owner.displayName} ·{" "}
              {publicRequest?.skill.name}
            </Copy>
          )}
          {!command.uncertain && <ConnectionFeedback error={command.error} />}
          <ApiProposalForm
            key={requestId ?? sharingSkillId}
            pending={command.pending}
            locked={command.uncertain}
            disabled={query.isFetching || !runtime.isCurrent()}
            onSubmit={submit}
          />
        </Panel>
      ) : (
        !command.uncertain &&
        (!valid || (!query.isPending && !query.error)) && (
          <EmptyState
            title="Không thể gửi đề xuất"
            description="Chọn yêu cầu đang mở hoặc kỹ năng công khai của một người khác."
            action="Khám phá"
            onAction={() => router.dismissTo("/discover")}
          />
        )
      )}
    </FeaturePage>
  );
}
