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
];
