import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/components/AppScreenLayout";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { InfoModal } from "@/components/InfoModal";
import { iconSizes, typography, fonts } from "@/constants/theme";
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
import { calendarColors as colors } from "../constants/theme";

export function CalendarScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [month, setMonth] = useState(calendarPeriod.initialMonth);
  const [day, setDay] = useState<number | null>(null);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [detail, setDetail] = useState<{ title: string; body: string } | null>(
    null,
  );
  const sessions = upcomingSessions.filter(
    (item) =>
      day === null ||
      (month === calendarPeriod.initialMonth && item.day === day),
  );
  const clearDay = () => setDay(null);
  return (
    <AppScreenLayout
      title="Lịch học"
      selected="Lịch học"
      contentStyle={styles.background}
      rightAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lịch sử học"
          onPress={() => {
            setTab("history");
            clearDay();
          }}
          style={({ pressed }) => [
            styles.historyLink,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Icon name="clock" size={iconSizes.inline} color={colors.orange} />
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
                  style={({ pressed }) => [
                    styles.tab,
                    tab === value && styles.activeTab,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      tab === value && styles.activeTabText,
                    ]}
                  >
                    {value === "upcoming" ? "Sắp tới" : "Đã học"}
                  </Text>
                  {value === "upcoming" && (
                    <View style={styles.tabCount}>
                      <Text style={styles.tabCountText}>
                        {upcomingSessions.length}
                      </Text>
                    </View>
                  )}
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
                  style={styles.bookMore}
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
  background: { backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 840,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  list: { gap: 12 },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.segment,
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    paddingVertical: 9,
    gap: 6,
  },
  activeTab: {
    backgroundColor: colors.surface,
    boxShadow: "0 1px 5px rgba(53, 43, 31, 0.08)",
  },
  activeTabText: { color: colors.ink, fontFamily: fonts.bold },
  tabText: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.muted,
  },
  link: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.orange,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  selectedDate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  historyAction: { alignItems: "center", paddingVertical: 8 },
  historyLink: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orangeSoft,
  },
  tabCountText: {
    fontFamily: fonts.bold,
    ...typography.caption,
    color: colors.orange,
    fontVariant: ["tabular-nums"],
  },
  bookMore: { borderRadius: 6, backgroundColor: colors.orangeSoft },
});
