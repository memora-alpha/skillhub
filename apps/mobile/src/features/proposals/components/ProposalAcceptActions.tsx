import { Button } from "@/components/Button";
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
  return (
    <>
      {needsRequest && (
        <>
          <ConnectionFeedback
            loading={query.isLoading}
            error={query.error}
            retry={query.refetch}
          />
          {!query.isPending &&
            !query.isFetching &&
            !query.error &&
            !available && (
              <>
                <FormNotice tone="info" compact>
                  Yêu cầu học hiện không nhận thêm đề xuất.
                </FormNotice>
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onPress={() => void query.refetch()}
                >
                  Tải lại yêu cầu học
                </Button>
              </>
            )}
        </>
      )}
      <Button
        variant="craft"
        disabled={inactive}
        onPress={() => {
          if (!inactive) void onAccept(proposal.version, requestVersion);
        }}
      >
        Chấp nhận và trò chuyện
      </Button>
    </>
  );
}
