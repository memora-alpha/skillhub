import type { IconName } from "@/components/console/icon";

type ModerationView = "profile" | "reviews";
type Search = { get: (name: string) => string | null };
export type AdminTab = Readonly<{
  id: string;
  href: string;
  path: string;
  label: string;
  view?: ModerationView;
}>;
export type AdminSectionGroup =
  | "Tổng quan & Vận hành"
  | "Kiểm duyệt & Xử lý"
  | "Người dùng & Danh mục"
  | "Hệ thống";

export const adminSectionGroups: readonly AdminSectionGroup[] = [
  "Tổng quan & Vận hành",
  "Kiểm duyệt & Xử lý",
  "Người dùng & Danh mục",
  "Hệ thống",
];

export type AdminSection = Readonly<{
  id: string;
  href: string;
  label: string;
  icon: IconName;
  group: AdminSectionGroup;
  tabs?: readonly AdminTab[];
}>;

export const adminSections: readonly AdminSection[] = [
  {
    id: "overview",
    href: "/admin",
    label: "Tổng quan",
    icon: "grid",
    group: "Tổng quan & Vận hành",
  },
  {
    id: "learning-paths",
    href: "/admin/learning-paths",
    label: "Lộ trình học",
    icon: "book",
    group: "Tổng quan & Vận hành",
  },
  {
    id: "finance",
    href: "/admin/credits",
    label: "Tài chính & Credit",
    icon: "card",
    group: "Tổng quan & Vận hành",
  },
  {
    id: "rewards",
    href: "/admin/rewards",
    label: "Voucher & phần thưởng",
    icon: "award",
    group: "Tổng quan & Vận hành",
  },
  {
    id: "moderation",
    href: "/admin/moderation",
    label: "Kiểm duyệt",
    icon: "flag",
    group: "Kiểm duyệt & Xử lý",
    tabs: [
      {
        id: "requests",
        href: "/admin/moderation",
        path: "/admin/moderation",
        label: "Bài nhu cầu học",
      },
      {
        id: "materials",
        href: "/admin/content",
        path: "/admin/content",
        label: "Tài liệu học tập",
      },
      {
        id: "evidence",
        href: "/admin/evidence",
        path: "/admin/evidence",
        label: "Xác minh kỹ năng",
      },
      {
        id: "reviews",
        href: "/admin/profile-moderation?view=reviews",
        path: "/admin/profile-moderation",
        label: "Đánh giá",
        view: "reviews",
      },
      {
        id: "profiles",
        href: "/admin/profile-moderation?view=profile",
        path: "/admin/profile-moderation",
        label: "Hồ sơ",
        view: "profile",
      },
      {
        id: "chat-attachments",
        href: "/admin/chat-attachments",
        path: "/admin/chat-attachments",
        label: "Tệp chat",
      },
    ],
  },
  {
    id: "support",
    href: "/admin/disputes",
    label: "Tranh chấp & Hỗ trợ",
    icon: "alert",
    group: "Kiểm duyệt & Xử lý",
    tabs: [
      {
        id: "reports",
        href: "/admin/disputes",
        path: "/admin/disputes",
        label: "Báo cáo & tranh chấp",
      },
      {
        id: "terminations",
        href: "/admin/learning-changes",
        path: "/admin/learning-changes",
        label: "Yêu cầu dừng lộ trình",
      },
    ],
  },
  {
    id: "reputation",
    href: "/admin/reputation",
    label: "Uy tín & Hạn chế",
    icon: "shield",
    group: "Kiểm duyệt & Xử lý",
  },
  {
    id: "people",
    href: "/admin/users",
    label: "Người dùng & nhân sự",
    icon: "users",
    group: "Người dùng & Danh mục",
    tabs: [
      {
        id: "users",
        href: "/admin/users",
        path: "/admin/users",
        label: "Người dùng",
      },
      {
        id: "staff",
        href: "/admin/staff-permissions",
        path: "/admin/staff-permissions",
        label: "Nhân viên & phân quyền",
      },
    ],
  },
  {
    id: "catalog",
    href: "/admin/skills",
    label: "Kỹ năng & Tag",
    icon: "tag",
    group: "Người dùng & Danh mục",
    tabs: [
      {
        id: "skills",
        href: "/admin/skills",
        path: "/admin/skills",
        label: "Kỹ năng & trình độ",
      },
      {
        id: "tags",
        href: "/admin/tags",
        path: "/admin/tags",
        label: "Tag cộng đồng",
      },
      {
        id: "tag-requests",
        href: "/admin/tag-requests",
        path: "/admin/tag-requests",
        label: "Đề xuất tag",
      },
    ],
  },
  {
    id: "settings",
    href: "/admin/config",
    label: "Quy tắc & Cài đặt",
    icon: "sliders",
    group: "Hệ thống",
  },
  {
    id: "audit",
    href: "/admin/audit",
    label: "Nhật ký hoạt động",
    icon: "clock",
    group: "Hệ thống",
  },
];

function matchesPath(pathname: string, path: string) {
  return (
    pathname === path || (path !== "/admin" && pathname.startsWith(path + "/"))
  );
}

export function adminModerationView(
  view?: string | null,
  userId?: string | null,
): ModerationView {
  if (view === "profile" || view === "reviews") return view;
  const validUser =
    !!userId && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(userId);
  return validUser ? "profile" : "reviews";
}

export function findAdminSection(pathname: string) {
  return adminSections.find((section) =>
    section.tabs
      ? section.tabs.some((tab) => matchesPath(pathname, tab.path))
      : matchesPath(pathname, section.href),
  );
}

export function findAdminTab(
  section: AdminSection,
  pathname: string,
  search: Search,
) {
  return section.tabs?.find(
    (tab) =>
      matchesPath(pathname, tab.path) &&
      (!tab.view ||
        tab.view ===
          adminModerationView(search.get("view"), search.get("userId"))),
  );
}
