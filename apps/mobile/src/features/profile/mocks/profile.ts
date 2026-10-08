import type { IconName } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";

export const profileDetails: {
  tagline: string;
  bio: string;
  badges: { icon: IconName; label: string; color: string }[];
} = {
  tagline: "Frontend Developer & React Enthusiast",
  bio: "Frontend Developer với 3 năm kinh nghiệm. Đam mê React, TypeScript và Node.js. Đang học tiếng Anh IELTS để mở rộng cơ hội nghề nghiệp.",
  badges: [
    { icon: "award", label: "Huy hiệu cúp", color: colors.gold },
    { icon: "zap", label: "Huy hiệu năng lượng", color: colors.brand },
    { icon: "compass", label: "Huy hiệu mục tiêu", color: colors.sage },
  ],
};
export const profileActions: {
  label: string;
  icon: IconName;
  color: string;
}[] = [
  {
    label: "Ví Credit",
    icon: "wallet",
    color: colors.brand,
  },
  {
    label: "Kỹ năng",
    icon: "book",
    color: colors.sage,
  },
  {
    label: "Thành tích",
    icon: "award",
    color: colors.gold,
  },
  {
    label: "Xác minh",
    icon: "shield",
    color: "#6B3DB5",
  },
  {
    label: "Đánh giá",
    icon: "star",
    color: "#F59E0B",
  },
  {
    label: "Cài đặt",
    icon: "settings",
    color: colors.inkSoft,
  },
];
