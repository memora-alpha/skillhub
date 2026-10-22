import { useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { learningRoutes } from "@/constants/navigation";
import { AppScreenLayout } from "@/features/shell";
import {
  useSessionsMonth,
  ApiSessionCard,
  SessionReadFeedback,
  filterCalendarSessions,
} from "@/features/sessions";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
import { Copy, RouteButton, ui } from "@/components/feature-page";
import { MonthCalendar } from "../components/MonthCalendar";
export function CalendarScreen() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date());
  const [day, setDay] = useState<number | null>(null);
  const [tab, setTab] = useState("Sắp tới");
  const month = date.getMonth();
  const year = date.getFullYear();
  const query = useSessionsMonth(year, month);
  const monthSessions = query.data ?? [];
  const visible = filterCalendarSessions(
    monthSessions,
    day,
    tab !== "Sắp tới",
    Date.now(),
  );
  return (
    <AppScreenLayout title="Lịch học" selected="Lịch học">
      {() => (
        <ScrollView
          contentContainerStyle={ui.page}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isLoading}
              onRefresh={() => {
                void query.refetch();
              }}
            />
          }
        >
          <SessionReadFeedback query={query} />
          <MonthCalendar
            month={month}
            year={year}
            sessionDays={monthSessions.map((s) =>
              new Date(s.startAt).getDate(),
            )}
            selectedDay={day}
            onDayPress={(value) => setDay(day === value ? null : value)}
            onMonthChange={(value) => {
              setDate(new Date(year, value, 1));
              setDay(null);
            }}
          />
          <ChoiceGroup
            label="Buổi học"
            options={["Sắp tới", "Đã kết thúc / lịch sử"]}
            value={tab}
            onChange={setTab}
          />
          {day !== null && (
            <Button variant="paper" onPress={() => setDay(null)}>
              Xem cả tháng
            </Button>
          )}
          {visible.map((s) => (
            <ApiSessionCard key={s.id} session={s} />
          ))}
          {monthSessions.length === 100 && (
            <Copy muted>
              Đang hiển thị tối đa 100 buổi trong tháng. Danh sách có thể chưa
              đầy đủ.
            </Copy>
          )}
          {query.data && !query.error && !visible.length && (
            <EmptyState
              title="Không có buổi học phù hợp"
              description="Thử ngày, tháng hoặc nhóm buổi học khác."
            />
          )}
          <Button
            variant="craft"
            onPress={() => router.push(learningRoutes.paths)}
          >
            Learning Path của tôi
          </Button>
          <RouteButton secondary href="/learning-history">
            Lịch sử học theo tháng
          </RouteButton>
        </ScrollView>
      )}
    </AppScreenLayout>
  );
}
