import type { IconName } from "@/components/Icon";
import type { Href } from "expo-router";

export const learningRoutes = {
  requests: { pathname: "/my-learning", params: { tab: "requests" } },
  paths: { pathname: "/my-learning", params: { tab: "paths" } },
} as const satisfies Record<string, Href>;

// Shared by the bottom tabs, header actions and feature shortcuts.
export const appRoutes: Record<string, Href | undefined> = {
  "Trang chủ": "/home",
  "Khám phá": "/discover",
  "Khám phá kỹ năng": "/search",
  "Tìm kỹ năng": "/search",
  "Yêu cầu học phù hợp": "/discover",
  "Lịch học": "/calendar",
  "Tin nhắn": "/messages",
  "Hồ sơ": "/profile",
  "Hành trình của tôi": "/my-learning",
  "Cài đặt": "/account-settings",
  "Thông báo": "/notifications",
  "Tìm kiếm": "/search",
  "Ví Credit": "/wallet",
  "Tài liệu của tôi": "/materials/mine",
  "Tài liệu học tập": "/materials",
  "Trung tâm trợ giúp": "/help",
  "Kỹ năng": "/my-skills",
  "Thêm kỹ năng chia sẻ": "/my-skills/new",
  "Xác minh kỹ năng": "/my-skills",
  "Thành tích": "/achievements",
  "Tiến trình huy hiệu": "/achievements",
  "Đánh giá": "/reviews",
  "Uy tín": "/reputation",
  "Báo cáo của tôi": "/reports",
  "Đăng yêu cầu học": "/requests/new",
  "Tạo yêu cầu học đầu tiên": "/requests/new",
  "Yêu cầu học của tôi": learningRoutes.requests,
  "Yêu cầu của tôi": learningRoutes.requests,
  "Learning Path đang học": "/paths/path-active",
  "Lộ trình đang học": "/paths/path-active",
  "Vào học": "/learning-sessions/active-react-1/room",
  "Learning Path của tôi": learningRoutes.paths,
  "Lộ trình của tôi": learningRoutes.paths,
  "Bộ giao diện mobile": "/ui",
};

export const appTabs: { name: string; label: string; icon: IconName }[] = [
  { name: "home", label: "Trang chủ", icon: "home" },
  { name: "discover", label: "Khám phá", icon: "compass" },
  { name: "calendar", label: "Lịch học", icon: "calendar" },
  { name: "messages", label: "Tin nhắn", icon: "message" },
  { name: "profile", label: "Hồ sơ", icon: "user" },
];
export const accountItems: { label: string; icon: IconName }[] = [
  { label: "Hồ sơ", icon: "user" },
  { label: "Ví Credit", icon: "wallet" },
  { label: "Tài liệu của tôi", icon: "book" },
  { label: "Cài đặt", icon: "settings" },
  { label: "Trung tâm trợ giúp", icon: "help" },
  { label: "Bộ giao diện mobile", icon: "compass" },
];
