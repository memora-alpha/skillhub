import type { IconName } from "@/components/Icon";
import { colors } from "@/constants/theme";

export const profileDetails = {
  tagline: "Frontend Developer & React Enthusiast",
  bio: "Frontend Developer với 3 năm kinh nghiệm. Đam mê React, TypeScript và Node.js. Đang học tiếng Anh IELTS để mở rộng cơ hội nghề nghiệp.",
  verified: true,
  stats: [
    { value: "142", label: "Reputation" },
    { value: "8", label: "Đã học" },
    { value: "12", label: "Đã dạy" },
    { value: "4.9", label: "Đánh giá" },
  ],
  sharingSkills: [
    { name: "React & Frontend", level: "Nâng cao", verified: true },
    { name: "JavaScript", level: "Chuyên gia", verified: true },
    { name: "TypeScript", level: "Trung cấp", verified: false },
  ],
  badges: [
    { symbol: "🏆", label: "Huy hiệu cúp" },
    { symbol: "⚡", label: "Huy hiệu năng lượng" },
    { symbol: "🎯", label: "Huy hiệu mục tiêu" },
  ],
};
export const profileActions: {
  label: string;
  icon: IconName;
  color: string;
}[] = [
  { label: "Ví Credit", icon: "wallet", color: colors.brand },
  { label: "Kỹ năng", icon: "book", color: colors.sage },
  { label: "Thành tích", icon: "award", color: colors.gold },
  { label: "Xác minh", icon: "shield", color: "#6B3DB5" },
  { label: "Đánh giá", icon: "star", color: "#F59E0B" },
  { label: "Cài đặt", icon: "settings", color: colors.muted },
];
