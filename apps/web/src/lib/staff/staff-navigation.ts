import type { IconName } from "@/components/console/icon";
import { hasAnyPermission, type StaffPermissionCode } from "./permissions";
import type { StaffIdentity } from "./types";

export type StaffNavGroup =
  "Tổng quan" | "Kiểm duyệt nội dung" | "Xử lý vụ việc" | "Hệ thống";

export type StaffNavItem = Readonly<{
  id: string;
  href: string;
  label: string;
  description: string;
  icon: IconName;
  group: StaffNavGroup;
  requiredAny?: readonly StaffPermissionCode[];
}>;

export const staffNavGroups: readonly StaffNavGroup[] = [
  "Tổng quan",
  "Kiểm duyệt nội dung",
  "Xử lý vụ việc",
  "Hệ thống",
];

export const staffNavItems: readonly StaffNavItem[] = [
  {
    id: "overview",
    href: "/staff",
    label: "Tổng quan vận hành",
    description: "Hàng đợi ưu tiên theo quyền được cấp.",
    icon: "grid",
    group: "Tổng quan",
  },
  {
    id: "evidence",
    href: "/staff/evidence",
    label: "Bằng chứng kỹ năng",
    description: "Xác minh chứng chỉ và tài liệu năng lực chia sẻ.",
    icon: "shield",
    group: "Kiểm duyệt nội dung",
    requiredAny: ["skill-verification:read"],
  },
  {
    id: "moderation",
    href: "/staff/moderation",
    label: "Yêu cầu học",
    description: "Duyệt bài nhu cầu học bị gắn cờ hoặc có tag mới.",
    icon: "flag",
    group: "Kiểm duyệt nội dung",
    requiredAny: ["learning-request:moderation:read"],
  },
  {
    id: "content",
    href: "/staff/content",
    label: "Tài liệu số",
    description: "Kiểm duyệt tài liệu miễn phí và trả phí trước khi công bố.",
    icon: "file",
    group: "Kiểm duyệt nội dung",
    requiredAny: ["material:moderate"],
  },
  {
    id: "profile-moderation",
    href: "/staff/profile-moderation",
    label: "Hồ sơ & đánh giá",
    description: "Kiểm duyệt đánh giá lộ trình, đánh giá tài liệu và hồ sơ.",
    icon: "users",
    group: "Kiểm duyệt nội dung",
    requiredAny: [
      "profile:moderate",
      "review:moderate",
      "material-review:moderate",
    ],
  },
  {
    id: "disputes",
    href: "/staff/disputes",
    label: "Báo cáo & tranh chấp",
    description: "Tiếp nhận, trao đổi và giải quyết vụ việc theo phiên học.",
    icon: "alert",
    group: "Xử lý vụ việc",
    requiredAny: ["report:moderate"],
  },
  {
    id: "learning-changes",
    href: "/staff/learning-changes",
    label: "Yêu cầu dừng lộ trình",
    description: "Xem xét phương án phân bổ Credit và dừng thỏa thuận học.",
    icon: "clock",
    group: "Xử lý vụ việc",
    requiredAny: ["report:moderate"],
  },
  {
    id: "notifications",
    href: "/staff/notifications",
    label: "Thông báo",
    description: "Cập nhật vận hành theo thời gian thực.",
    icon: "bell",
    group: "Hệ thống",
  },
];

export function visibleStaffNavItems(
  actor: StaffIdentity | null | undefined,
): readonly StaffNavItem[] {
  return staffNavItems.filter(
    (item) => !item.requiredAny || hasAnyPermission(actor, item.requiredAny),
  );
}

export function findStaffNavItem(pathname: string): StaffNavItem | undefined {
  return staffNavItems.find((item) =>
    item.href === "/staff"
      ? pathname === "/staff"
      : pathname === item.href || pathname.startsWith(item.href + "/"),
  );
}
