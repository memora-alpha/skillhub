import { useRouter, type Href } from "expo-router";
import {
  FlowPage as FeaturePage,
  FlowSection as Panel,
} from "@/components/learning-flow";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { useRequestDetail } from "@/features/learning-requests";
import { usePublicSkill, useTeacherEligibility } from "@/features/skills";
import {
  useConnections,
  useConnectionCommand,
  ConnectionFeedback,
  useConnectionQuery,
  useParticipantProfile,
} from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useProposalsApi } from "../hooks/use-proposals-api";
import { ApiProposalForm } from "../components/ApiProposalForm";
import { ProposalSendContext } from "../components/proposal-send-layout";
import { ProposalReadiness } from "../components/proposal-readiness";
import { findPendingProposal } from "../api/proposal-preflight";
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
    (!publicRequest.expiresAt ||
      Date.parse(publicRequest.expiresAt) > Date.now()) &&
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
    !!skillQuery.data && skillQuery.data.skill.status === "ACTIVE",
    userId,
    runtime.userId,
  );
  const query = direct ? skillQuery : requestQuery;
  const recipientId = direct ? userId : publicRequest?.owner.id;
  const targetSkillId = direct
    ? skillQuery.data?.skill.id
    : publicRequest?.skill.id;
  const profile = useParticipantProfile(recipientId);
  const teacher = useTeacherEligibility(
    !direct && allowed ? targetSkillId : undefined,
    publicRequest?.verifiedTeacherOnly ?? false,
  );
  const pending = useConnectionQuery(
    ["proposals", "preflight", requestId, recipientId, targetSkillId],
    (signal) =>
      findPendingProposal(
        (cursor, s) => api.list("sent", "PENDING", cursor, s),
        { requestId, recipientId: recipientId!, skillId: targetSkillId! },
        signal,
      ),
    allowed && !!recipientId && !!targetSkillId,
  );
  const checking =
    pending.isPending ||
    pending.isFetching ||
    (!direct && (teacher.isPending || teacher.isFetching));
  const preflightError = pending.error ?? (!direct ? teacher.error : undefined);
  const canCompose =
    !checking &&
    !preflightError &&
    !pending.data &&
    (direct || teacher.data?.state === "eligible");
  const valid = direct
    ? uuid.safeParse(userId).success && uuid.safeParse(sharingSkillId).success
    : uuid.safeParse(requestId).success;
  const openResult = (result: Proposal | undefined) => {
    if (result && runtime.isCurrent())
      router.dismissTo({
        pathname: "/proposals",
        params: { tab: "sent", status: "PENDING" },
      });
  };
  const submit = async (hints: ProposalHints) => {
    if (
      !allowed ||
      !canCompose ||
      query.error ||
      query.isFetching ||
      command.uncertain ||
      command.pending ||
      !runtime.isCurrent()
    )
      return;
    const source = await query.refetch();
    if (source.error || !source.data || !runtime.isCurrent()) return;
    if (
      !direct &&
      "owner" in source.data &&
      (source.data.status !== "OPEN" ||
        source.data.owner.id !== recipientId ||
        source.data.skill.id !== targetSkillId ||
        source.data.verifiedTeacherOnly !==
          publicRequest?.verifiedTeacherOnly ||
        (source.data.expiresAt &&
          Date.parse(source.data.expiresAt) <= Date.now()))
    )
      return;
    if (
      direct &&
      "skill" in source.data &&
      "status" in source.data.skill &&
      source.data.skill.status !== "ACTIVE"
    )
      return;
    const duplicate = await pending.refetch();
    if (duplicate.error || duplicate.data || !runtime.isCurrent()) return;
    if (!direct) {
      const eligibility = await teacher.refetch();
      if (
        eligibility.error ||
        eligibility.data?.state !== "eligible" ||
        !runtime.isCurrent()
      )
        return;
    }
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
      scrollable={false}
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
        <>
          <ApiProposalForm
            framed
            header={
              <>
                <ProposalSendContext
                  direct={direct}
                  title={
                    direct
                      ? (skillQuery.data?.skill.name ?? "Kỹ năng")
                      : (publicRequest?.title ?? "Yêu cầu học")
                  }
                  skill={
                    direct
                      ? (skillQuery.data?.skill.name ?? "Kỹ năng")
                      : (publicRequest?.skill.name ?? "Kỹ năng")
                  }
                  name={
                    profile.data?.fullName ??
                    publicRequest?.owner.displayName ??
                    "Đối tác"
                  }
                  userId={recipientId!}
                  avatarUrl={profile.data?.avatarUrl}
                />
                <ProposalReadiness
                  skill={
                    direct
                      ? (skillQuery.data?.skill.name ?? "Kỹ năng")
                      : (publicRequest?.skill.name ?? "Kỹ năng")
                  }
                  teacher={direct ? undefined : teacher.data}
                  duplicate={pending.data}
                  checking={checking}
                  error={preflightError}
                  retry={() => {
                    void pending.refetch();
                    if (!direct) void teacher.refetch();
                  }}
                />
                {!command.uncertain && (
                  <ConnectionFeedback error={command.error} />
                )}
              </>
            }
            oneWayLabel={direct ? "Tôi muốn học từ bạn" : "Tôi muốn dạy bạn"}
            key={requestId ?? sharingSkillId}
            pending={command.pending}
            locked={command.uncertain}
            disabled={
              !canCompose ||
              !!query.error ||
              query.isFetching ||
              !runtime.isCurrent()
            }
            onSubmit={submit}
          />
        </>
      ) : (
        !command.uncertain &&
        (!valid || (!query.isPending && !query.error)) && (
          <EmptyState
            title="Không thể gửi đề xuất"
            description={
              userId === runtime.userId ||
              (requestQuery.data && !("owner" in requestQuery.data))
                ? "Bạn không thể gửi đề xuất cho chính mình."
                : publicRequest?.expiresAt &&
                    Date.parse(publicRequest.expiresAt) <= Date.now()
                  ? "Yêu cầu học đã hết hạn, hiện không nhận thêm đề xuất."
                  : publicRequest && publicRequest.status !== "OPEN"
                    ? "Yêu cầu học hiện không nhận thêm đề xuất."
                    : "Chọn yêu cầu đang mở hoặc kỹ năng công khai còn hoạt động của một người khác."
            }
            action="Khám phá"
            onAction={() => router.dismissTo("/discover")}
          />
        )
      )}
    </FeaturePage>
  );
}
