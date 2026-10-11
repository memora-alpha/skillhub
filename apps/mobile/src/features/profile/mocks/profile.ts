import type { IconName } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";

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
    label: "Tài liệu của tôi",
    icon: "book",
    color: colors.sage,
  },
  {
    label: "Hành trình của tôi",
    icon: "clipboard",
    color: colors.sage,
  },
  {
    label: "Đánh giá về tôi",
    icon: "star",
    color: colors.gold,
  },
  {
    label: "Thành tích",
    icon: "award",
    color: colors.gold,
  },
  {
    label: "Cài đặt",
    icon: "settings",
    color: colors.inkSoft,
  },
];
