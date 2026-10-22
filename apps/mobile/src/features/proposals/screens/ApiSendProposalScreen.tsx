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
  return !result.error && !result.data && isCurrent();
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

function ProposalRecoveryPanel({
  uncertain,
  pending,
  error,
  originalError,
  isCurrent,
  retry,
  onOpenSent,
  openResult,
}: Readonly<{
  uncertain: boolean;
  pending: boolean;
  error: unknown;
  originalError: unknown;
  isCurrent: () => boolean;
  retry: () => Promise<Proposal | undefined>;
  onOpenSent: () => void;
  openResult: (proposal: Proposal | undefined) => void;
}>) {
  if (!uncertain) return null;
  return (
    <Panel title="Kiểm tra lần gửi trước">
      <FormNotice tone="info">
        Chưa xác định được đề xuất đã gửi thành công hay chưa. Nội dung được giữ
        nguyên để kiểm tra lại, tránh tạo đề xuất trùng.
      </FormNotice>
      <ConnectionFeedback error={originalError} />
      {error !== originalError && <ConnectionFeedback error={error} />}
      <Button
        variant="craft"
        disabled={pending || !isCurrent()}
        onPress={() => {
          void retry().then(openResult);
        }}
      >
        {pending ? "Đang kiểm tra..." : "Kiểm tra lại lần gửi trước"}
      </Button>
      <Button variant="secondary" disabled={pending} onPress={onOpenSent}>
        Xem đề xuất đã gửi
      </Button>
    </Panel>
  );
}

function ProposalFormSection({
  direct,
  skillName,
  requestTitle,
  requestSkill,
  recipientName,
  recipientId,
  avatarUrl,
  teacher,
  duplicate,
  checking,
  preflightError,
  retry,
  commandUncertain,
  commandError,
  pending,
  disabled,
  formKey,
  onSubmit,
}: Readonly<{
  direct: boolean;
  skillName?: string;
  requestTitle?: string;
  requestSkill?: string;
  recipientName?: string;
  recipientId: string;
  avatarUrl?: string | null;
  teacher?: {
    state: "eligible" | "missing" | "unverified";
    sharingSkillId?: string;
  };
  duplicate?: { id: string } | null;
  checking: boolean;
  preflightError: unknown;
  retry: () => void;
  commandUncertain: boolean;
  commandError: unknown;
  pending: boolean;
  disabled: boolean;
  formKey?: string;
  onSubmit: (hints: ProposalHints) => Promise<unknown>;
}>) {
  const displayName = recipientName ?? "Đối tác";
  const displaySkill = direct
    ? (skillName ?? "Kỹ năng")
    : (requestSkill ?? "Kỹ năng");
  return (
    <ApiProposalForm
      framed
      header={
        <>
          <ProposalSendContext
            direct={direct}
            title={
              direct
                ? (skillName ?? "Kỹ năng")
                : (requestTitle ?? "Yêu cầu học")
            }
            skill={displaySkill}
            name={displayName}
            userId={recipientId}
            avatarUrl={avatarUrl}
          />
          <ProposalReadiness
            skill={displaySkill}
            teacher={direct ? undefined : teacher}
            duplicate={duplicate}
            checking={checking}
            error={preflightError}
            retry={retry}
          />
          {!commandUncertain && <ConnectionFeedback error={commandError} />}
        </>
      }
      oneWayLabel={direct ? "Tôi muốn học từ bạn" : "Tôi muốn dạy bạn"}
      key={formKey}
      pending={pending}
      locked={commandUncertain}
      disabled={disabled}
      onSubmit={onSubmit}
    />
  );
}

function ProposalUnavailable({
  visible,
  description,
  onAction,
}: Readonly<{ visible: boolean; description: string; onAction: () => void }>) {
  if (!visible) return null;
  return (
    <EmptyState
      title="Không thể gửi đề xuất"
      description={description}
      action="Khám phá"
      onAction={onAction}
    />
  );
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
          pending={command.pending}
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
