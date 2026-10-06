import { calendarPeriod, upcomingSessions } from "./calendar";

const titles: Record<string, string | undefined> = {
  "react-router": "React Router — Buổi 4/6",
  redux: "Redux Toolkit — Buổi 5/6",
  "final-project": "Dự án cuối — Buổi 6/6",
};
const days = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
export const sessionDetails = upcomingSessions.map((session) => {
  const [datePart = "", timePart = ""] = session.time.split(", ");
  const [start = "", end = ""] = timePart.split(" – ");
  const minutes = (time: string) => {
    const [hour = 0, minute = 0] = time.split(":").map(Number);
    return hour * 60 + minute;
  };
  return {
    ...session,
    detailTitle: titles[session.id] ?? session.title,
    date: `${days[new Date(calendarPeriod.year, calendarPeriod.firstMonth, session.day).getDay()]}, ${datePart}/${calendarPeriod.year}`,
    timeRange: timePart,
    durationMinutes: minutes(end) - minutes(start),
    partnerRole: session.role === "Học" ? "Người hướng dẫn" : "Người học",
  };
});
