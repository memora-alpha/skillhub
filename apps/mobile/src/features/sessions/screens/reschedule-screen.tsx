import { useLocalSearchParams } from "expo-router";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { AppScreenLayout } from "@/features/shell";
import { useSessionDetail } from "../hooks/use-sessions";
import { useSessionReschedule } from "../hooks/use-session-reschedule";
import { SessionFeedback } from "../components/session-feedback";
import { RescheduleDraft } from "../components/reschedule-draft";
import { RescheduleProposalPanel } from "../components/reschedule-proposal-panel";
import { rescheduleStyles as styles } from "../components/reschedule.styles";
import { deviceTimezone } from "../utils/session-time";
import { isRescheduleEligible } from "../utils/reschedule-form";
import { sessionErrorMessage } from "../utils/session-read";

export function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useSessionDetail(id),
    session = query.data;
  const action = useSessionReschedule(session);
  const timezone = deviceTimezone();
  const disabled =
    !session ||
    !query.valid ||
    query.isFetching ||
    query.isError ||
    !action.contextReady ||
    !isRescheduleEligible(session) ||
    action.pending ||
    action.blocked;
  return (
    <AppScreenLayout
      title="Đề nghị đổi lịch"
      selected="Lịch học"
      back={{ href: "/calendar", label: "Quay lại", behavior: "history" }}
      contentStyle={styles.background}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={styles.page}>
          <SessionFeedback
            {...query}
            invalid={!query.valid}
            refreshing={query.isFetching || action.pending}
            retry={() => query.refetch()}
          >
            {session && (
              <RescheduleDraft
                key={session.id}
                session={session}
                timezone={timezone}
                expectedVersion={action.snapshot?.version}
                disabled={disabled || !!action.snapshot?.hasPending}
                pending={action.pending}
                onSubmit={(input) => {
                  if (
                    !disabled &&
                    action.snapshot &&
                    !action.snapshot.hasPending
                  )
                    void action.propose(action.snapshot.scheduleId, input);
                }}
              />
            )}
            {session && action.contextLoading && !action.snapshot && (
              <FormNotice tone="info">
                Đang tải lịch hiện tại để kiểm tra đề nghị đổi lịch…
              </FormNotice>
            )}
            {session &&
              isRescheduleEligible(session) &&
              !action.contextLoading &&
              !action.contextReady && (
                <FormNotice tone="info">
                  Chưa đọc được lịch hiện tại để gửi hoặc xác nhận đề nghị. Kéo
                  xuống để tải lại.
                </FormNotice>
              )}
            {session && !!action.message && (
              <FormNotice tone="info">{action.message}</FormNotice>
            )}
            {session && !!action.error && (
              <FormNotice tone="error">
                {sessionErrorMessage(action.error)}
              </FormNotice>
            )}
            {session && action.blocked && (
              <>
                <FormNotice tone="info">
                  {action.uncertain
                    ? "Chưa xác định được kết quả thao tác. Kiểm tra trạng thái trước khi gửi hoặc xác nhận lại."
                    : "Cần tải lại trạng thái đổi lịch trước khi tiếp tục."}
                </FormNotice>
                <Button
                  variant="paper"
                  disabled={action.pending}
                  onPress={() => {
                    void action.refresh();
                  }}
                >
                  Kiểm tra trạng thái đổi lịch
                </Button>
              </>
            )}
            {session && (
              <RescheduleProposalPanel
                snapshot={action.snapshot}
                timezone={timezone}
                loading={action.contextLoading}
                error={action.contextError}
                disabled={disabled}
                pending={action.pending}
                onConfirm={() => {
                  if (
                    !disabled &&
                    action.snapshot?.pending &&
                    !action.snapshot.ownConfirmed
                  )
                    void action.confirm(
                      action.snapshot.scheduleId,
                      action.snapshot.version,
                    );
                }}
              />
            )}
          </SessionFeedback>
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
