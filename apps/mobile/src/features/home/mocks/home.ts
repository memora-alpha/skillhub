import type { IconName } from "@/components/Icon";

export const onboardingTasks: {
  label: string;
  done: boolean;
  icon: IconName;
}[] = [
  { label: "Hoàn thiện hồ sơ", done: true, icon: "user" },
  { label: "Thêm kỹ năng chia sẻ", done: true, icon: "award" },
  { label: "Khám phá kỹ năng", done: false, icon: "search" },
  { label: "Tạo yêu cầu học đầu tiên", done: false, icon: "edit" },
];
export const newUserSummary = {
  credit: 50,
  reputation: 50,
  learned: 0,
  taught: 0,
};
export const returningSummary = {
  credit: 340,
  reputation: 142,
  learned: 8,
  taught: 12,
};
export const nextSession = {
  title: "React Hooks & State Management",
  mentor: "Trần Việt Anh",
  mentorId: "demo-viet-anh",
  schedule: "Thứ 5, 20:00 – 21:30",
};
export const learningPath = {
  title: "React cho người mới bắt đầu",
  completed: 3,
  total: 6,
  next: "Thứ 5, 20:00",
};
export const matchingRequests = [
  {
    id: "react",
    title: "Muốn học React từ cơ bản đến nâng cao",
    name: "Lê Hồng Anh",
    userId: "demo-hong-anh",
    credit: 50,
    match: 95,
  },
  {
    id: "portfolio",
    title: "Cần mentor hướng dẫn xây dựng portfolio",
    name: "Vũ Minh Tuấn",
    userId: "demo-minh-tuan",
    credit: 45,
    match: 87,
  },
];
export const achievement = {
  icon: "🎓",
  title: "Người học chăm chỉ",
  description: "Hoàn thành 10 buổi học",
  completed: 8,
  total: 10,
};
