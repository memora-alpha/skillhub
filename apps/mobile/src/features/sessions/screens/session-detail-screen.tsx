import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Icon } from "@/components/Icon";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { appColors as colors } from "@/constants/theme";
import { AppScreenLayout } from "@/features/shell";
import { useSessionDetail } from "../hooks/use-sessions";
import { useSessionPartner } from "../hooks/use-session-partner";
import { useSessionAction } from "../hooks/use-session-action";
import { useSessionsRuntime } from "../runtime";
import { SessionFeedback } from "../components/session-feedback";
import { SessionDetailContent } from "../components/session-detail-content";
import { SessionContextPanel } from "../components/session-context-panel";
import { CompletionConfirmDialog } from "../components/completion-confirm-dialog";
import { SessionButton } from "../components/session-page";
import { detailStyles as styles } from "../components/session-detail.styles";
import { deviceTimezone } from "../utils/session-time";
import { completionSubmitPresentation } from "../utils/completion-presentation";
import { canConfirmSession } from "../utils/session-policy";
import { sessionErrorMessage } from "../utils/session-read";
import { isRescheduleEligible } from "../utils/reschedule-form";

export function LearningSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const query = useSessionDetail(id),
    partner = useSessionPartner(query.data),
    action = useSessionAction(id);
  const { userId } = useSessionsRuntime();
  const session = query.data,
    timezone = deviceTimezone();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submit = completionSubmitPresentation(
    session,
    userId,
    action.receipt,
    action.pending,
  );
  const ended =
    session &&
    (Date.parse(session.endAt) <= Date.now() ||
      session.status === "COMPLETED" ||
      submit.confirmed);
  const blocked = session && ["CANCELLED", "DISPUTED"].includes(session.status);
  const disabled =
    !session ||
    !canConfirmSession(session, userId) ||
    query.isFetching ||
    query.isError ||
    action.pending ||
    action.blocked ||
    !!action.receipt ||
    submit.confirmed;
  const actionLabel = !ended
    ? "Đề nghị đổi lịch"
    : submit.confirmed || action.pending
      ? submit.label
      : "Xác nhận hoàn thành";
  useEffect(() => {
    if (disabled) setConfirmOpen(false);
  }, [disabled]);
  useEffect(() => setConfirmOpen(false), [id]);
  useFocusEffect(useCallback(() => () => setConfirmOpen(false), []));
  function confirm() {
    if (!confirmOpen || disabled) return;
    setConfirmOpen(false);
    void action.run();
  }
  return (
    <AppScreenLayout
      title="Chi tiết buổi học"
      selected="Lịch học"
      back={{ href: "/calendar", label: "Quay lại", behavior: "history" }}
      contentStyle={styles.background}
    >
      {() => (
        <>
          <RefreshableScrollView
            style={styles.scroll}
            contentContainerStyle={styles.page}
            showsVerticalScrollIndicator={false}
          >
            <SessionFeedback
              {...query}
              invalid={!query.valid}
              refreshing={query.isFetching || action.pending}
              retry={() => query.refetch()}
            >
              {session && (
                <SessionDetailContent
                  session={session}
                  userId={userId}
                  timezone={timezone}
                  partner={partner.data ?? undefined}
                  onOpenPartner={() =>
                    router.push({
                      pathname: "/profiles/[userId]",
                      params: {
                        userId:
                          session.teacherId === userId
                            ? session.learnerId
                            : session.teacherId,
                      },
                    })
                  }
                />
              )}
              {session && <SessionContextPanel session={session} />}
              {action.receipt && (
                <FormNotice tone="info">
                  Hệ thống đã ghi nhận xác nhận của bạn.
                  {action.error ? " Chưa tải lại được trạng thái mới." : ""}
                </FormNotice>
              )}
              {!!action.error && (
                <FormNotice tone="error">
                  {sessionErrorMessage(action.error)}
                  {!action.receipt
                    ? " Tải lại để kiểm tra kết quả trước khi thử lại."
                    : ""}
                </FormNotice>
              )}
              {action.blocked && (!submit.confirmed || !!action.error) && (
                <SessionButton
                  variant="paper"
                  disabled={action.pending}
                  onPress={() => {
                    void action.refresh();
                  }}
                >
                  Kiểm tra trạng thái xác nhận
                </SessionButton>
              )}
            </SessionFeedback>
          </RefreshableScrollView>
          {session &&
            query.valid &&
            !blocked &&
            (ended || isRescheduleEligible(session)) && (
              <View style={styles.footer}>
                <View style={styles.footerInner}>
                  <Button
                    accessibilityLabel={actionLabel}
                    variant={submit.confirmed ? "paper" : "craft"}
                    style={styles.action}
                    disabled={
                      ended ? disabled : query.isFetching || query.isError
                    }
                    onPress={() => {
                      if (ended) {
                        if (!disabled) setConfirmOpen(true);
                      } else {
                        router.push(
                          `/learning-sessions/${session.id}/reschedule`,
                        );
                      }
                    }}
                  >
                    {!ended && (
                      <Icon name="calendar" size={18} color={colors.white} />
                    )}
                    <Text
                      style={[
                        styles.actionText,
                        submit.confirmed && styles.confirmedActionText,
                      ]}
                    >
                      {actionLabel}
                    </Text>
                  </Button>
                </View>
              </View>
            )}
          <CompletionConfirmDialog
            visible={confirmOpen && !disabled}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={confirm}
          />
        </>
      )}
    </AppScreenLayout>
  );
}
