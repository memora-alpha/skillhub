import type { IconName } from "@/components/Icon";
import type { Href } from "expo-router";

// Shared by the bottom tabs, header actions and feature shortcuts.
export const appRoutes: Record<string, Href | undefined> = {
  "Trang chủ": "/home",
  "Khám phá": "/discover",
  "Khám phá kỹ năng": "/discover",
  "Tìm kỹ năng": "/discover",
  "Yêu cầu học phù hợp": "/discover",
  "Lịch học": "/calendar",
  "Tin nhắn": "/messages",
  "Hồ sơ": "/profile",
};

export const appTabs: { label: string; icon: IconName }[] = [
  { label: "Trang chủ", icon: "home" },
  { label: "Khám phá", icon: "compass" },
  { label: "Lịch học", icon: "calendar" },
  { label: "Tin nhắn", icon: "message" },
  { label: "Hồ sơ", icon: "user" },
];
export const accountItems: { label: string; icon: IconName }[] = [
  { label: "Hồ sơ", icon: "user" },
  { label: "Ví Credit", icon: "wallet" },
  { label: "Tài liệu của tôi", icon: "book" },
  { label: "Cài đặt", icon: "settings" },
  { label: "Trung tâm trợ giúp", icon: "help" },
];
