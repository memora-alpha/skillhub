import type { IconName } from "@/components/console/icon";
import { hasAnyPermission } from "./permissions";
import type { StaffIdentity } from "./types";

export type StaffNavGroup =
  "Kiểm duyệt nội dung" | "Tranh chấp & Xử lý" | "Ưu đãi & Gói";

export type StaffNavGroupMeta = Readonly<{
  id: string;
  group: StaffNavGroup;
  defaultOpen: boolean;
}>;

export type StaffNavItem = Readonly<{
  id: string;
  href: string;
  label: string;
  description: string;
  icon: IconName;
  group?: StaffNavGroup;
  requiredAny?: readonly string[];
}>;

export const staffNavGroupConfigs: readonly StaffNavGroupMeta[] = [
  { id: "moderation", group: "Kiểm duyệt nội dung", defaultOpen: true },
  { id: "disputes", group: "Tranh chấp & Xử lý", defaultOpen: true },
  { id: "benefits", group: "Ưu đãi & Gói", defaultOpen: false },
];

export const staffNavGroups: readonly StaffNavGroup[] =
  staffNavGroupConfigs.map((entry) => entry.group);

export const staffNavItems: readonly StaffNavItem[] = [
  {
    id: "overview",
    href: "/staff",
    label: "Tổng quan",
    description: "Hàng đợi ưu tiên theo quyền được cấp.",
    icon: "grid",
  },
  {
    id: "evidence",
    href: "/staff/evidence",
    label: "Xác minh kỹ năng",
    description: "Xác minh chứng chỉ và tài liệu năng lực chia sẻ.",
    icon: "shield",
    group: "Kiểm duyệt nội dung",
    requiredAny: ["skill-verification:read"],
  },
  {
    id: "moderation",
    href: "/staff/moderation",
    label: "Bài nhu cầu học",
    description: "Duyệt bài nhu cầu học bị gắn cờ hoặc có tag mới.",
    icon: "flag",
    group: "Kiểm duyệt nội dung",
    requiredAny: ["learning-request:moderation:read"],
  },
  {
    id: "content",
    href: "/staff/content",
    label: "Tài liệu học tập",
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
    id: "chat-attachments",
    href: "/staff/chat-attachments",
    label: "Tệp đính kèm chat",
    description: "Kiểm duyệt tệp tin nhắn bị gắn cờ và thu hồi quyền tải.",
    icon: "file",
    group: "Kiểm duyệt nội dung",
    requiredAny: ["chat-attachment:moderate"],
  },
  {
    id: "disputes",
    href: "/staff/disputes",
    label: "Báo cáo & tranh chấp",
    description: "Tiếp nhận, trao đổi và giải quyết tranh chấp theo buổi học.",
    icon: "alert",
    group: "Tranh chấp & Xử lý",
    requiredAny: ["report:moderate"],
  },
  {
    id: "restriction-reviews",
    href: "/staff/restriction-reviews",
    label: "Duyệt gỡ hạn chế",
    description: "Xem xét gỡ các hạn chế hoạt động theo hồ sơ uy tín.",
    icon: "shield",
    group: "Tranh chấp & Xử lý",
    requiredAny: ["report:moderate"],
  },
  {
    id: "learning-changes",
    href: "/staff/learning-changes",
    label: "Yêu cầu dừng lộ trình",
    description: "Xem xét phương án phân bổ Credit và dừng thỏa thuận học.",
    icon: "clock",
    group: "Tranh chấp & Xử lý",
    requiredAny: ["report:moderate"],
  },
  {
    id: "subscriptions",
    href: "/staff/subscriptions",
    label: "Gói thành viên",
    description: "Tra cứu gói thành viên, hạn mức sử dụng và phiên bản gói.",
    icon: "star",
    group: "Ưu đãi & Gói",
    requiredAny: ["subscription:read"],
  },
  {
    id: "rewards",
    href: "/staff/rewards",
    label: "Voucher & phần thưởng",
    description: "Quản lý danh mục và xử lý đơn đổi thưởng.",
    icon: "award",
    group: "Ưu đãi & Gói",
    requiredAny: ["reward:manage"],
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
