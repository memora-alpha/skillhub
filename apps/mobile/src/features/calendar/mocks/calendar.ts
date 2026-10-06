export type UpcomingSession = {
  id: string;
  title: string;
  day: number;
  time: string;
  partner: string;
  role: "Học" | "Dạy";
  credit: string;
  days: number;
};
// Deliberately fixed to the source's demo period, not the device's current date.
export const calendarPeriod = {
  year: 2025,
  firstMonth: 1,
  lastMonth: 3,
  today: 5,
};
export const weekDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const upcomingSessions: UpcomingSession[] = [
  {
    id: "react-router",
    title: "React Router — Buổi 4",
    day: 8,
    time: "08/02, 20:00 – 21:30",
    partner: "Trần Việt Anh",
    role: "Học",
    credit: "200 CR",
    days: 3,
  },
  {
    id: "redux",
    title: "Redux Toolkit — Buổi 5",
    day: 13,
    time: "13/02, 20:00 – 21:30",
    partner: "Trần Việt Anh",
    role: "Học",
    credit: "200 CR",
    days: 8,
  },
  {
    id: "final-project",
    title: "Dự án cuối — Buổi 6",
    day: 15,
    time: "15/02, 20:00 – 21:30",
    partner: "Trần Việt Anh",
    role: "Học",
    credit: "200 CR",
    days: 10,
  },
  {
    id: "ielts",
    title: "Tiếng Anh IELTS — Buổi 1",
    day: 18,
    time: "18/02, 19:00 – 20:30",
    partner: "Nguyễn Thị Bích",
    role: "Dạy",
    credit: "+180 CR",
    days: 13,
  },
];
export type LearningPathHistory = {
  id: string;
  name: string;
  partner: string;
  role: "Học" | "Dạy";
  sessions: number;
  period: string;
  credit: string;
  rating: number;
  status: "completed" | "cancelled";
  sessionList: boolean[];
  sessionDates: string[];
};
export const learningHistory: LearningPathHistory[] = [
  {
    id: "react",
    name: "React từ cơ bản đến nâng cao",
    partner: "Trần Việt Anh",
    role: "Học",
    sessions: 6,
    period: "Tháng 1–2/2025",
    credit: "-1.200 CR",
    rating: 5,
    status: "completed",
    sessionList: [true, true, true, true, true, true],
    sessionDates: ["25/01", "01/02", "04/02", "08/02", "13/02", "15/02"],
  },
  {
    id: "python",
    name: "Python cơ bản & ứng dụng",
    partner: "Lê Văn Nam",
    role: "Dạy",
    sessions: 4,
    period: "Tháng 1/2025",
    credit: "+640 CR",
    rating: 4,
    status: "completed",
    sessionList: [true, true, true, true],
    sessionDates: ["16/01", "23/01", "28/01", "31/01"],
  },
  {
    id: "ielts",
    name: "Tiếng Anh IELTS luyện thi",
    partner: "Vũ Minh Tuấn",
    role: "Dạy",
    sessions: 3,
    period: "Đầu tháng 1/2025",
    credit: "+540 CR",
    rating: 5,
    status: "completed",
    sessionList: [true, true, true],
    sessionDates: ["03/01", "07/01", "10/01"],
  },
  {
    id: "japanese",
    name: "Tiếng Nhật N3 giao tiếp",
    partner: "Phạm Hương Ly",
    role: "Học",
    sessions: 2,
    period: "Tháng 1/2025",
    credit: "–",
    rating: 0,
    status: "cancelled",
    sessionList: [true, false],
    sessionDates: ["15/01", "22/01"],
  },
];
