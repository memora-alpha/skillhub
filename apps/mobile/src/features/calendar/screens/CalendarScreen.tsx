import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/components/AppScreenLayout";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { InfoModal } from "@/components/InfoModal";
import { colors, fonts, radius } from "@/constants/theme";
import { MonthCalendar } from "../components/MonthCalendar";
import {
  HistoryPathCard,
  UpcomingSessionCard,
} from "../components/SessionCards";
import {
  calendarPeriod,
  learningHistory,
  upcomingSessions,
} from "../mocks/calendar";

export function CalendarScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [month, setMonth] = useState(2); // March 2025, matching the source's initial view.
  const [day, setDay] = useState<number | null>(null);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [detail, setDetail] = useState<{ title: string; body: string } | null>(
    null,
  );
  const sessions = upcomingSessions.filter(
    (item) =>
      day === null || (month === calendarPeriod.firstMonth && item.day === day),
  );
  const clearDay = () => setDay(null);
  return (
    <AppScreenLayout
      title="Lịch học"
      selected="Lịch học"
      rightAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lịch sử học"
          onPress={() => {
            setTab("history");
            clearDay();
          }}
          style={{ paddingVertical: 6 }}
        >
          <Text style={styles.link}>Lịch sử</Text>
        </Pressable>
      }
    >
      {() => (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <MonthCalendar
              month={month}
              selectedDay={day}
              onMonthChange={(value) => {
                setMonth(value);
                clearDay();
              }}
              onDayPress={(value) => {
                setDay(day === value ? null : value);
                setTab("upcoming");
              }}
            />
            <View style={styles.tabs}>
              {(["upcoming", "history"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === value }}
                  aria-selected={tab === value}
                  onPress={() => {
                    setTab(value);
                    clearDay();
                  }}
                  style={[styles.tab, tab === value && styles.activeTab]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      tab === value && { color: colors.ink },
                    ]}
                  >
                    {value === "upcoming"
                      ? `Sắp tới (${upcomingSessions.length})`
                      : "Đã học"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {tab === "upcoming" ? (
              <View style={styles.list}>
                {day !== null && (
                  <View style={styles.selectedDate}>
                    <Text style={styles.caption}>
                      {day}/{month + 1}/{calendarPeriod.year}
                    </Text>
                    <Pressable accessibilityRole="button" onPress={clearDay}>
                      <Text style={styles.link}>Xem tất cả</Text>
                    </Pressable>
                  </View>
                )}
                {sessions.map((session) => (
                  <UpcomingSessionCard
                    key={session.id}
                    session={session}
                    onPress={() =>
                      router.push({
                        pathname: "/session/[id]",
                        params: { id: session.id },
                      })
                    }
                  />
                ))}
                {!sessions.length && (
                  <EmptyState
                    icon="calendar"
                    title="Chưa có buổi học"
                    description="Không có buổi học mẫu vào ngày đã chọn."
                    action="Xem tất cả buổi học"
                    onAction={clearDay}
                  />
                )}
                <Button
                  variant="secondary"
                  onPress={() => router.navigate("/discover")}
                >
                  + Đặt thêm buổi học
                </Button>
              </View>
            ) : (
              <View style={styles.list}>
                {learningHistory
                  .slice(0, expandedHistory ? learningHistory.length : 3)
                  .map((path) => (
                    <HistoryPathCard
                      key={path.id}
                      path={path}
                      onPress={() =>
                        setDetail({
                          title: path.name,
                          body: `Với ${path.partner} · Vai trò: ${path.role}\n${path.period}\n${path.sessions} buổi · ${path.credit}\n${path.status === "completed" ? "Đã hoàn tất" : "Đã hủy"}\nNgày học: ${path.sessionDates.join(", ")}\n\nĐây là lịch sử mẫu, không có giao dịch Credit thực tế.`,
                        })
                      }
                    />
                  ))}
                {!expandedHistory && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExpandedHistory(true)}
                    style={styles.historyAction}
                  >
                    <Text style={styles.link}>Xem toàn bộ lịch sử →</Text>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>
          <InfoModal
            title={detail?.title ?? null}
            onClose={() => setDetail(null)}
          >
            {detail?.body}
          </InfoModal>
        </>
      )}
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
  },
  list: { gap: 12 },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.sand,
    borderRadius: radius.card,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.control,
    paddingVertical: 8,
  },
  activeTab: {
    backgroundColor: colors.white,
  },
  tabText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  link: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.brand,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  selectedDate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  historyAction: { alignItems: "center", paddingVertical: 8 },
});
