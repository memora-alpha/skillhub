import type { LearningPath, Plan } from "./types";
export function futureSlot(days: number, hour = 19) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
const plan = (id: string, mine: boolean): Plan => ({
  id,
  teacher: mine ? "me" : "partner",
  learner: mine ? "partner" : "me",
  skill: mine ? "React" : "UI/UX",
  goal: mine
    ? "Tự xây dựng ứng dụng React với component và hook."
    : "Thiết kế giao diện sản phẩm theo quy trình UX.",
  outline: mine
    ? ["Component và state", "Hook và dự án thực hành"]
    : ["Nghiên cứu người dùng", "Wireframe và prototype"],
  version: 1,
  learnerVersion: 1,
  schedule: {
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    slots: [1, 2].map((day) => ({
      startAt: futureSlot(day, mine ? 19 : 15),
      duration: 90,
    })),
  },
});
export const initialPaths: LearningPath[] = [
  {
    id: "path-draft",
    title: "React ↔ UI/UX",
    partner: "Hồng Anh",
    type: "TWO_WAY",
    credit: "40",
    version: 1,
    partnerVersion: 1,
    status: "PROPOSED",
    plans: [plan("draft-react", true), plan("draft-ux", false)].map((p) => ({
      ...p,
      schedule: undefined,
    })),
    completedSessions: 0,
  },
  {
    id: "path-ready",
    title: "Trao đổi React và thiết kế",
    partner: "Hồng Anh",
    type: "TWO_WAY",
    credit: "40",
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: "PROPOSED",
    plans: [plan("ready-react", true), plan("ready-ux", false)],
    completedSessions: 0,
  },
  {
    id: "path-active",
    title: "React thực hành",
    partner: "Minh Khoa",
    type: "ONE_WAY",
    teacher: "partner",
    credit: "100",
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: "ACTIVE",
    plans: [
      {
        ...plan("active-react", false),
        skill: "React",
        goal: "Xây dựng một ứng dụng React hoàn chỉnh.",
        outline: ["Component và state", "Hook và dự án thực hành"],
        schedule: {
          ...plan("active-react", false).schedule!,
          slots: [8, 9].map((day) => ({
            startAt: futureSlot(day, 18),
            duration: 90,
          })),
        },
      },
    ],
    completedSessions: 0,
  },
  {
    id: "path-completed",
    title: "Tiếng Anh giao tiếp",
    partner: "Hồng Anh",
    type: "ONE_WAY",
    teacher: "partner",
    credit: "100",
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: "COMPLETED",
    plans: [
      {
        ...plan("completed-english", false),
        skill: "Tiếng Anh",
        goal: "Tự tin giao tiếp trong công việc.",
        outline: ["Hội thoại thực tế", "Thuyết trình dự án"],
        schedule: {
          version: 1,
          meVersion: 1,
          partnerVersion: 1,
          slots: [-21, -14].map((day) => ({
            startAt: futureSlot(day),
            duration: 90,
          })),
        },
      },
    ],
    completedSessions: 2,
  },
  {
    id: "path-disputed",
    title: "Thực hành TypeScript",
    partner: "Minh Khoa",
    type: "TWO_WAY",
    credit: "40",
    version: 1,
    status: "DISPUTED",
    plans: [plan("disputed-ts", true), plan("disputed-ux", false)].map((p) => ({
      ...p,
      schedule: {
        ...p.schedule!,
        slots: [12, 13].map((day) => ({
          startAt: futureSlot(day, p.teacher === "me" ? 19 : 15),
          duration: 90,
        })),
      },
    })),
    completedSessions: 0,
  },
  {
    id: "path-completed-two-way",
    title: "Trao đổi React ↔ UI/UX đã hoàn tất",
    partner: "Hồng Anh",
    type: "TWO_WAY",
    credit: "40",
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: "COMPLETED",
    completedSessions: 4,
    plans: [plan("finished-react", true), plan("finished-ux", false)].map(
      (p) => ({
        ...p,
        schedule: {
          ...p.schedule!,
          slots: p.schedule!.slots.map((s, i) => ({
            ...s,
            startAt: futureSlot(-21 + i * 7, p.teacher === "me" ? 19 : 15),
          })),
        },
      }),
    ),
  },
];
initialPaths.push(
  {
    id: "path-one-way-ready",
    title: "Bạn dạy React một chiều",
    partner: "Hồng Anh",
    type: "ONE_WAY",
    teacher: "me",
    credit: "10.50",
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: "PROPOSED",
    plans: [plan("oneway-ready-react", true)],
    completedSessions: 0,
  },
  {
    id: "path-no-credit",
    title: "Một chiều · thiếu số dư mẫu",
    partner: "Hồng Anh",
    type: "ONE_WAY",
    teacher: "partner",
    credit: "200",
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: "PROPOSED",
    plans: [plan("nocredit-react", false)],
    completedSessions: 0,
  },
  {
    id: "path-conflict",
    title: "Hai chiều · lịch trùng mẫu",
    partner: "Hồng Anh",
    type: "TWO_WAY",
    credit: "40",
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: "PROPOSED",
    plans: [
      plan("conflict-react", true),
      {
        ...plan("conflict-ux", false),
        schedule: {
          version: 1,
          meVersion: 1,
          partnerVersion: 1,
          slots: [1, 2].map((day) => ({
            startAt: futureSlot(day, 19),
            duration: 90,
          })),
        },
      },
    ],
    completedSessions: 0,
  },
  {
    id: "path-awaiting",
    title: "Buổi học chờ đối tác xác nhận",
    partner: "Hồng Anh",
    type: "ONE_WAY",
    teacher: "partner",
    credit: "40",
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: "ACTIVE",
    plans: [
      {
        ...plan("awaiting-ux", false),
        schedule: {
          ...plan("awaiting-ux", false).schedule!,
          slots: [16, 17].map((day) => ({
            startAt: futureSlot(day, 18),
            duration: 90,
          })),
        },
      },
    ],
    completedSessions: 0,
  },
  {
    id: "path-pending-plan",
    title: "Kế hoạch cần bạn xác nhận",
    partner: "Hồng Anh",
    type: "TWO_WAY",
    credit: "40",
    version: 1,
    partnerVersion: 1,
    status: "PROPOSED",
    plans: [
      { ...plan("pending-react", true), schedule: undefined },
      {
        ...plan("pending-ux", false),
        learnerVersion: undefined,
        schedule: undefined,
      },
    ],
    completedSessions: 0,
  },
);
