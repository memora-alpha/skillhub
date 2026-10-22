import { FlowSection as Panel } from "@/components/learning-flow";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback } from "@/features/connections";
import { ApiProposalForm } from "./ApiProposalForm";
import { ProposalSendContext } from "./proposal-send-layout";
import { ProposalReadiness } from "./proposal-readiness";
import type { Proposal, ProposalHints } from "../api/proposals-api";

export function ProposalRecoveryPanel({
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

export function ProposalFormSection({
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

export function ProposalUnavailable({
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
