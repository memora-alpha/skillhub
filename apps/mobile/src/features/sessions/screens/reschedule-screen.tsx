import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { AppScreenLayout } from "@/features/shell";
import { useSessionDetail } from "../hooks/use-sessions";
import { useSessionReschedule } from "../hooks/use-session-reschedule";
import { useSessionClock } from "../hooks/use-session-clock";
import { SessionFeedback } from "../components/session-feedback";
import { RescheduleDraft } from "../components/reschedule-draft";
import { RescheduleProposalPanel } from "../components/reschedule-proposal-panel";
import { rescheduleStyles as styles } from "../components/reschedule.styles";
import { deviceTimezone } from "../utils/session-time";
import {
  isRescheduleEligible,
  rescheduleAvailabilityMessage,
} from "../utils/reschedule-form";
import { sessionErrorMessage } from "../utils/session-read";

export function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useSessionDetail(id),
    session = query.data;
  const action = useSessionReschedule(session);
  const timezone = deviceTimezone();
  const now = useSessionClock(session, () => {
    if (query.enabled) void query.refetch({ cancelRefetch: false });
  });
  const [makeupSessionId, setMakeupSessionId] = useState<string>();
  useEffect(() => {
    setMakeupSessionId((current) => {
      if (session?.status === "MAKEUP_REQUIRED") return session.id;
      return current === id ? current : undefined;
    });
  }, [id, session?.id, session?.status]);
  const makeup =
    session?.status === "MAKEUP_REQUIRED" || makeupSessionId === id;
  const makeupBooked =
    makeup && !!session && ["CONFIRMED", "READY"].includes(session.status);
  const eligible = !!session && isRescheduleEligible(session, now);
  const disabled =
    !session ||
    !query.valid ||
    query.isFetching ||
    query.isError ||
    !action.contextReady ||
    !eligible ||
    action.pending ||
    action.blocked;
  return (
    <AppScreenLayout
      title={makeup ? "Lịch học bù" : "Đề nghị đổi lịch"}
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
                hasPending={action.snapshot?.hasPending}
                now={now}
                makeup={makeup}
                applied={makeupBooked}
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
              <FormNotice compact tone="info">
                Đang tải lịch học…
              </FormNotice>
            )}
            {session &&
              eligible &&
              !action.contextLoading &&
              !action.contextError &&
              !action.contextReady && (
                <FormNotice compact tone="info">
                  Chưa thể thay đổi lịch. Kéo xuống để cập nhật trạng thái.
                </FormNotice>
              )}
            {session && !!action.message && (
              <FormNotice compact tone="info">
                {action.message}
              </FormNotice>
            )}
            {session && !!action.error && (
              <FormNotice compact tone="error">
                {sessionErrorMessage(action.error, makeup)}
              </FormNotice>
            )}
            {session && action.blocked && !action.pending && (
              <>
                <FormNotice compact tone="info">
                  {action.uncertain
                    ? "Chưa rõ kết quả. Kiểm tra trạng thái trước khi thử lại."
                    : "Tải lại trạng thái lịch trước khi tiếp tục."}
                </FormNotice>
                <Button
                  variant="paper"
                  disabled={action.pending}
                  onPress={() => {
                    void action.refresh();
                  }}
                >
                  Kiểm tra trạng thái
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
                makeup={makeup}
                unavailableMessage={
                  !eligible
                    ? rescheduleAvailabilityMessage(session, now)
                    : undefined
                }
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
