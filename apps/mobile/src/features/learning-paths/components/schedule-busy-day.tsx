import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "expo-router";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback } from "@/features/connections";
import {
  deviceTimezone,
  listIsLimited,
  useSessionList,
} from "@/features/sessions";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import {
  scheduleBusyRange,
  scheduleOverlap,
  scheduleWindowLabel,
  type ScheduleSlot,
} from "../utils/schedule-conflicts";

export function ScheduleBusyDay({
  slot,
  allowed,
  warnedSessionIds = [],
}: Readonly<{
  slot: ScheduleSlot;
  allowed: boolean;
  warnedSessionIds?: readonly string[];
}>) {
  const focused = useIsFocused();
  const range = scheduleBusyRange(slot);
  const query = useSessionList(
    { from: range.from, to: range.to },
    deviceTimezone(),
    allowed && focused,
  );
  const sessions = (query.data ?? []).filter(
    (session) =>
      session.status !== "CANCELLED" &&
      Date.parse(session.startAt) < Date.parse(range.dayEnd) &&
      Date.parse(session.endAt) > Date.parse(range.dayStart),
  );
  const available =
    query.enabled && !query.error && !query.denial && query.data !== undefined;
  const visibleSessions = sessions.filter(
    (session) =>
      !warnedSessionIds.includes(session.id) || !scheduleOverlap(slot, session),
  );
  if (
    available &&
    !query.isFetching &&
    !listIsLimited(query.data!) &&
    sessions.length > 0 &&
    visibleSessions.length === 0
  )
    return null;
  let feedback: ReactNode = null;
  if (!query.enabled)
    feedback = <Text style={styles.note}>Chưa đối chiếu lịch đã chốt.</Text>;
  else if (query.error || query.denial)
    feedback = (
      <>
        <FormNotice tone="info" compact>
          Chưa đối chiếu được lịch đã chốt của bạn. Lịch đang nhập vẫn được giữ.
        </FormNotice>
        <ConnectionFeedback
          error={query.error}
          retry={() => query.refetch({ cancelRefetch: false })}
        />
      </>
    );
  else if (query.isFetching)
    feedback = (
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        Đang đối chiếu lịch đã chốt…
      </Text>
    );
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.heading}>
        Lịch đã chốt của bạn ·{" "}
        {new Date(slot.startAt).toLocaleDateString("vi-VN")}
      </Text>
      {feedback}
      {available && (
        <>
          {listIsLimited(query.data!) && (
            <FormNotice tone="info" compact>
              Danh sách đã đạt giới hạn 100 buổi; có thể còn lịch chưa được tải.
            </FormNotice>
          )}
          {visibleSessions.map((session) => {
            const overlap = scheduleOverlap(slot, session);
            const label = `Lịch ${session.role === "TEACHER" ? "dạy" : "học"}: ${scheduleWindowLabel(session)}.`;
            if (!overlap)
              return (
                <Text key={session.id} style={styles.note}>
                  {label}
                </Text>
              );
            return (
              <FormNotice key={session.id} tone="error" compact>
                Trùng {label.toLocaleLowerCase("vi-VN")} Hãy chọn giờ khác.
              </FormNotice>
            );
          })}
          {!sessions.length && (
            <Text style={styles.note}>
              Chưa thấy buổi học đã chốt của bạn trong ngày này.
            </Text>
          )}
        </>
      )}
      <Text style={styles.note}>
        Lịch riêng của người còn lại chưa hiển thị ở đây. Hệ thống kiểm tra lại
        lịch của cả hai khi chốt.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  heading: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  note: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
