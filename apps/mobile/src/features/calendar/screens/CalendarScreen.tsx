import { RefreshableScrollView as ScrollView } from "@/components/RefreshableScrollView";
import { useState } from "react";
import { useIsFocused } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { fonts, typography } from "@/constants/theme";
import { AppScreenLayout } from "@/features/shell";
import {
  useSessionList,
  sessionRange,
  deviceTimezone,
  sessionDay,
  listIsLimited,
  SessionFeedback,
} from "@/features/sessions";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { useQuietReadRecovery } from "@/lib/query/use-quiet-read-recovery";
import { MonthCalendar } from "../components/MonthCalendar";
import { CalendarSessionCard } from "../components/CalendarSessionCard";
import { calendarColors as colors } from "../constants/theme";

export function CalendarScreen() {
  const focused = useIsFocused();
  const [date, setDate] = useState(() => new Date());
  const [day, setDay] = useState<number | null>(() => date.getDate());
  const month = date.getMonth(),
    year = date.getFullYear(),
    timezone = deviceTimezone();
  const query = useSessionList(
    sessionRange(year, month, null, timezone),
    timezone,
    focused,
  );
  useQuietReadRecovery({
    error: query.error,
    fetching: query.isFetching,
    enabled: query.enabled,
    retry: () => query.refetch({ cancelRefetch: false }),
  });
  const sessions = query.data ?? [];
  const visible = sessions.filter(
    (s) => day === null || sessionDay(s.startAt, timezone) === day,
  );
  return (
    <AppScreenLayout
      title="Lịch học"
      selected="Lịch học"
      contentStyle={styles.background}
    >
      {() => (
        <ScrollView
          style={styles.background}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}
        >
          <MonthCalendar
            month={month}
            year={year}
            sessionDays={[
              ...new Set(sessions.map((s) => sessionDay(s.startAt, timezone))),
            ]}
            selectedDay={day}
            onDayPress={(value) => setDay(day === value ? null : value)}
            onMonthChange={(value) => {
              setDate(new Date(year, value, 1));
              setDay(null);
            }}
          />
          <Text accessibilityRole="header" style={styles.heading}>
            Buổi học
          </Text>
          <SessionFeedback
            {...query}
            quietTransient
            refreshing={query.isFetching}
            retry={() => query.refetch({ cancelRefetch: false })}
          >
            {listIsLimited(sessions) && (
              <FormNotice tone="info">
                Tháng này đang hiển thị tối đa 100 buổi. Dữ liệu có thể chưa đầy
                đủ.
              </FormNotice>
            )}
            {visible.map((s) => (
              <CalendarSessionCard key={s.id} session={s} timezone={timezone} />
            ))}
            {!visible.length && (
              <EmptyState
                title={
                  day === null
                    ? "Chưa có buổi học trong tháng này"
                    : "Chưa có buổi học trong ngày này"
                }
                description="Chọn ngày hoặc tháng khác để xem lịch học."
                titleStyle={styles.heading}
              />
            )}
          </SessionFeedback>
        </ScrollView>
      )}
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
  },
  background: { backgroundColor: colors.background },
  page: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 16,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 16,
  },
});
