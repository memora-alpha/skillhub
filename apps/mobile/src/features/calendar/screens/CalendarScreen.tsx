import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { useSessionsPreview } from "@/features/sessions";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
import { Panel, Copy, RouteButton, ui } from "@/components/feature-page";
import { MonthCalendar } from "../components/MonthCalendar";
export function CalendarScreen() {
  const router = useRouter();
  const { sessions } = useSessionsPreview();
  const [date, setDate] = useState(() => new Date());
  const [day, setDay] = useState<number | null>(null);
  const [tab, setTab] = useState("Sắp tới");
  const month = date.getMonth();
  const year = date.getFullYear();
  const monthSessions = sessions.filter((s) => {
    const d = new Date(s.startAt);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const visible = monthSessions.filter(
    (s) =>
      (day === null || new Date(s.startAt).getDate() === day) &&
      (tab === "Sắp tới" ? s.status === "CONFIRMED" : s.status !== "CONFIRMED"),
  );
  return (
    <AppScreenLayout title="Lịch học" selected="Lịch học">
      {() => (
        <ScrollView contentContainerStyle={ui.page}>
          <Copy muted>
            Lịch và buổi học trong bản xem thử. Không có lịch tài khoản thật
            được tải tại đây.
          </Copy>
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
            <Panel key={s.id} title={s.title}>
              <Badge label={s.status} />
              <Copy>
                {s.partner} · {new Date(s.startAt).toLocaleString("vi-VN")} ·{" "}
                {s.duration} phút
              </Copy>
              <RouteButton href={`/learning-sessions/${s.id}`}>
                Mở buổi học
              </RouteButton>
            </Panel>
          ))}
          {!visible.length && (
            <EmptyState
              title="Không có buổi học phù hợp"
              description="Thử ngày, tháng hoặc nhóm buổi học khác."
            />
          )}
          <Button variant="craft" onPress={() => router.push("/paths")}>
            Lộ trình của tôi
          </Button>
          <RouteButton secondary href="/learning-history">
            Toàn bộ lịch sử học
          </RouteButton>
        </ScrollView>
      )}
    </AppScreenLayout>
  );
}
