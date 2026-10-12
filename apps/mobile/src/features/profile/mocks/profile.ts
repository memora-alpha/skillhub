import type { IconName } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";

export const profileActions: {
  label: string;
  icon: IconName;
  color: string;
}[] = [
  { label: "Yêu cầu học của tôi", icon: "book", color: colors.brand },
  {
    label: "Ví Credit",
    icon: "wallet",
    color: colors.brand,
  },
  {
    label: "Tài liệu của tôi",
    icon: "book",
    color: colors.sage,
  },
  {
    label: "Thành tích",
    icon: "award",
    color: colors.gold,
  },
  {
    label: "Xác minh kỹ năng",
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
