import type { IconName } from "@/components/Icon";
import { colors } from "@/constants/theme";

export const onboardingTasks = [
  { label: "Hoàn thiện hồ sơ", done: true, icon: "👤" },
  { label: "Thêm kỹ năng chia sẻ", done: true, icon: "🎯" },
  { label: "Khám phá kỹ năng", done: false, icon: "🔍" },
  { label: "Tạo yêu cầu học đầu tiên", done: false, icon: "📝" },
];
export const quickActions: {
  label: string;
  description: string;
  icon: IconName;
  background: string;
  color: string;
}[] = [
  {
    label: "Tìm kỹ năng",
    description: "Duyệt các yêu cầu học",
    icon: "compass",
    background: colors.brandLight,
    color: colors.brand,
  },
  {
    label: "Đăng yêu cầu",
    description: "Tìm người hướng dẫn",
    icon: "plus",
    background: colors.sageLight,
    color: colors.sage,
  },
  {
    label: "Cộng đồng",
    description: "Khám phá hồ sơ",
    icon: "users",
    background: "#F0EBF9",
    color: "#6B3DB5",
  },
  {
    label: "Kỹ năng của tôi",
    description: "Quản lý kỹ năng chia sẻ",
    icon: "book",
    background: "#FEF8E6",
    color: colors.gold,
  },
];
export const popularSkills = [
  "React",
  "Tiếng Anh IELTS",
  "Python",
  "Node.js",
  "Tiếng Nhật",
  "TypeScript",
];
export const newUserSummary = { credit: 50, reputation: 50 };
export const returningSummary = {
  credit: 340,
  reputation: 142,
  learned: 8,
  taught: 12,
};
export const nextSession = {
  title: "React Hooks & State Management",
  mentor: "Trần Việt Anh",
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
    credit: 50,
    match: 95,
  },
  {
    id: "portfolio",
    title: "Cần mentor hướng dẫn xây dựng portfolio",
    name: "Vũ Minh Tuấn",
    credit: 45,
    match: 87,
  },
];
export const recentMessages = [
  {
    id: "viet-anh",
    name: "Trần Việt Anh",
    message: "Xác nhận buổi học thứ 5 nhé bạn?",
    time: "2 giờ trước",
    unread: 2,
  },
  {
    id: "bich",
    name: "Nguyễn Thị Bích",
    message: "Mình muốn học Python cơ bản...",
    time: "5 giờ trước",
    unread: 0,
  },
];
export const achievement = {
  icon: "🎓",
  title: "Người học chăm chỉ",
  description: "Hoàn thành 10 buổi học",
  completed: 8,
  total: 10,
};
export const demoNotifications = [
  "Buổi học React với Trần Việt Anh sắp diễn ra.",
  "Bạn có 2 tin nhắn mới từ Trần Việt Anh.",
  "Có yêu cầu học phù hợp với kỹ năng của bạn.",
];
