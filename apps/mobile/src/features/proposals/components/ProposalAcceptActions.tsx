import { useState } from "react";
import { Button } from "@/components/Button";
import { Copy, Panel } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { useRequestDetail } from "@/features/learning-requests";
import { ConnectionFeedback } from "@/features/connections";
import type { Proposal } from "../api/proposals-api";

export function ProposalAcceptActions({
  proposal,
  disabled,
  onAccept,
}: Readonly<{
  proposal: Proposal;
  disabled: boolean;
  onAccept: (proposalVersion: number, requestVersion?: number) => Promise<void>;
}>) {
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const query = useRequestDetail(proposal.learningRequestId ?? undefined);
  const data = !query.error && !query.readDenied ? query.data : undefined;
  const request =
    data &&
    "skillId" in data &&
    data.id === proposal.learningRequestId &&
    data.skillId === proposal.skillId
      ? data
      : undefined;
  const needsRequest = proposal.sourceType === "LEARNING_REQUEST";
  const requestVersion = needsRequest ? request?.version : undefined;
  const available =
    !needsRequest ||
    (!!request && (request.effectiveStatus ?? request.status) === "OPEN");
  const inactive = disabled || !available || (needsRequest && query.isFetching);
  const signature = `${proposal.id}:${proposal.version}:${requestVersion ?? "direct"}`;
  return (
    <>
      {needsRequest && (
        <Panel title="Yêu cầu học hiện tại">
          <ConnectionFeedback
            loading={query.isLoading}
            error={query.error}
            retry={query.refetch}
          />
          {request && (
            <>
              <Copy>{request.title}</Copy>
              <Copy>{request.description}</Copy>
              <Copy>Mục tiêu: {request.learningGoal}</Copy>
              <Copy muted>
                {request.verifiedTeacherOnly
                  ? "Chỉ nhận người dạy đã xác minh kỹ năng."
                  : "Không yêu cầu xác minh kỹ năng người dạy."}
              </Copy>
            </>
          )}
          {!query.isPending && !query.error && !available && (
            <FormNotice tone="info">
              Yêu cầu học không còn nhận đề xuất hoặc không thể đọc nội dung
              hiện tại.
            </FormNotice>
          )}
          <Button
            variant="secondary"
            disabled={disabled || query.isFetching}
            onPress={() => {
              void query.refetch();
            }}
          >
            Tải lại yêu cầu học
          </Button>
        </Panel>
      )}
      <Button
        variant="craft"
        disabled={inactive}
        onPress={() => {
          if (!inactive) setConfirmation(signature);
        }}
      >
        Chấp nhận đề xuất
      </Button>
      {available && confirmation === signature && (
        <Panel title="Mở trò chuyện để cùng thống nhất?">
          <Copy>
            Hai bạn sẽ thống nhất nội dung học, chọn lịch rồi xem lại Credit
            trước khi chốt. Xác nhận tại đây chỉ mở Chat.
          </Copy>
          <Button
            disabled={inactive}
            onPress={() => {
              if (!inactive) void onAccept(proposal.version, requestVersion);
            }}
          >
            Xác nhận chấp nhận
          </Button>
          <Button
            variant="secondary"
            disabled={disabled}
            onPress={() => setConfirmation(null)}
          >
            Quay lại
          </Button>
        </Panel>
      )}
    </>
  );
}
