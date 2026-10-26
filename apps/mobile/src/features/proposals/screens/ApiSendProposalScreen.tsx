import {
  ProposalRecoveryPanel,
  ProposalFormSection,
  ProposalUnavailable,
} from "../components/proposal-send-content";
import { useRef, useState } from "react";
import { useRouter, type Href } from "expo-router";
import { FlowPage as FeaturePage } from "@/components/learning-flow";
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

type ProposalSourceSnapshot = {
  status?: string;
  expiresAt?: string | null;
  verifiedTeacherOnly?: boolean;
  owner?: { id?: string };
  skill?: { id?: string; status?: string };
};

function sourceMatchesProposal(
  source: unknown,
  direct: boolean,
  recipientId?: string,
  targetSkillId?: string,
  verifiedTeacherOnly?: boolean,
) {
  if (typeof source !== "object" || source === null) return false;
  const snapshot = source as ProposalSourceSnapshot;
  if (direct) return snapshot.skill?.status === "ACTIVE";
  const currentAndOpen =
    snapshot.status === "OPEN" &&
    snapshot.owner?.id === recipientId &&
    snapshot.skill?.id === targetSkillId &&
    snapshot.verifiedTeacherOnly === verifiedTeacherOnly;
  const notExpired =
    !snapshot.expiresAt || Date.parse(snapshot.expiresAt) > Date.now();
  return currentAndOpen && notExpired;
}

async function refetchValid(
  refetch: () => Promise<{ data?: unknown; error: unknown }>,
  isCurrent: () => boolean,
  validate: (data: unknown) => boolean,
) {
  const result = await refetch();
  return !!result.data && !result.error && isCurrent() && validate(result.data);
}

async function hasNoPendingProposal(
  refetch: () => Promise<{
    data: { id: string } | null | undefined;
    error: unknown;
  }>,
  isCurrent: () => boolean,
) {
  const result = await refetch();
  return !result.error && result.data === null && isCurrent();
}

function proposalInput(
  direct: boolean,
  hints: ProposalHints,
  sharingSkillId?: string,
  requestId?: string,
): ProposalInput {
  if (direct)
    return {
      ...hints,
      sourceType: "DIRECT_SEARCH",
      recipientSharingSkillId: sharingSkillId!,
    };
  return {
    ...hints,
    sourceType: "LEARNING_REQUEST",
    learningRequestId: requestId!,
  };
}

function unavailableDescription(input: {
  self: boolean;
  expired: boolean;
  closed: boolean;
}) {
  if (input.self) return "Bạn không thể gửi đề xuất cho chính mình.";
  if (input.expired)
    return "Yêu cầu học đã hết hạn, hiện không nhận thêm đề xuất.";
  if (input.closed) return "Yêu cầu học hiện không nhận thêm đề xuất.";
  return "Chọn yêu cầu đang mở hoặc kỹ năng công khai còn hoạt động của một người khác.";
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
  const command = useConnectionCommand<Proposal>([["proposals"]]);
  const submitting = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [preparationError, setPreparationError] = useState<unknown>();
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
  const submitPrepared = async (hints: ProposalHints) => {
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
    const validSource = await refetchValid(
      () => query.refetch(),
      runtime.isCurrent,
      (source) =>
        sourceMatchesProposal(
          source,
          direct,
          recipientId,
          targetSkillId,
          publicRequest?.verifiedTeacherOnly,
        ),
    );
    if (!validSource) return;
    if (!(await hasNoPendingProposal(pending.refetch, runtime.isCurrent)))
      return;
    if (!direct) {
      const eligibility = await teacher.refetch();
      if (
        eligibility.error ||
        eligibility.data?.state !== "eligible" ||
        !runtime.isCurrent()
      )
        return;
    }
    const body = proposalInput(direct, hints, sharingSkillId, requestId);
    const result = await command.run(JSON.stringify(body), (key) =>
      api.create(body, key),
    );
    openResult(result);
  };
  const submit = async (hints: ProposalHints) => {
    if (submitting.current || command.pending || command.uncertain) return;
    submitting.current = true;
    setPreparing(true);
    setPreparationError(undefined);
    try {
      await submitPrepared(hints);
    } catch (error) {
      if (runtime.isCurrent()) setPreparationError(error);
    } finally {
      submitting.current = false;
      if (runtime.isCurrent()) setPreparing(false);
    }
  };
  const showUnavailable =
    !command.uncertain && (!valid || (!query.isPending && !query.error));
  const unavailableText = unavailableDescription({
    self:
      userId === runtime.userId ||
      (!!requestQuery.data && !("owner" in requestQuery.data)),
    expired:
      !!publicRequest?.expiresAt &&
      Date.parse(publicRequest.expiresAt) <= Date.now(),
    closed: !!publicRequest && publicRequest.status !== "OPEN",
  });
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
      <ConnectionFeedback error={preparationError} />
      <ProposalRecoveryPanel
        uncertain={command.uncertain}
        pending={command.pending}
        error={command.error}
        originalError={command.originalError}
        isCurrent={runtime.isCurrent}
        retry={command.retry}
        onOpenSent={() =>
          router.push({ pathname: "/proposals", params: { tab: "sent" } })
        }
        openResult={openResult}
      />
      {allowed ? (
        <ProposalFormSection
          direct={direct}
          skillName={skillQuery.data?.skill.name}
          requestTitle={publicRequest?.title}
          requestSkill={publicRequest?.skill.name}
          recipientName={
            profile.data?.fullName ?? publicRequest?.owner.displayName
          }
          recipientId={recipientId!}
          avatarUrl={profile.data?.avatarUrl}
          teacher={teacher.data}
          duplicate={pending.data}
          checking={checking}
          preflightError={preflightError}
          retry={() => {
            void pending.refetch();
            if (!direct) void teacher.refetch();
          }}
          commandUncertain={command.uncertain}
          commandError={command.error}
          pending={command.pending || preparing}
          disabled={
            !canCompose ||
            !!query.error ||
            query.isFetching ||
            !runtime.isCurrent()
          }
          formKey={requestId ?? sharingSkillId}
          onSubmit={submit}
        />
      ) : (
        <ProposalUnavailable
          visible={showUnavailable}
          description={unavailableText}
          onAction={() => router.dismissTo("/discover")}
        />
      )}
    </FeaturePage>
  );
}
