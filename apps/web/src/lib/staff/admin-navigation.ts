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
export type AdminSection = Readonly<{
  id: string;
  href: string;
  label: string;
  icon: IconName;
  tabs?: readonly AdminTab[];
}>;

export const adminSections: readonly AdminSection[] = [
  { id: "overview", href: "/admin", label: "Tổng quan", icon: "grid" },
  {
    id: "learning-paths",
    href: "/admin/learning-paths",
    label: "Lộ trình học",
    icon: "book",
  },
  {
    id: "people",
    href: "/admin/users",
    label: "Người dùng & nhân sự",
    icon: "users",
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
    id: "moderation",
    href: "/admin/moderation",
    label: "Kiểm duyệt",
    icon: "shield",
    tabs: [
      {
        id: "requests",
        href: "/admin/moderation",
        path: "/admin/moderation",
        label: "Yêu cầu học",
      },
      {
        id: "materials",
        href: "/admin/content",
        path: "/admin/content",
        label: "Tài liệu",
      },
      {
        id: "profiles",
        href: "/admin/profile-moderation?view=profile",
        path: "/admin/profile-moderation",
        label: "Hồ sơ",
        view: "profile",
      },
      {
        id: "reviews",
        href: "/admin/profile-moderation?view=reviews",
        path: "/admin/profile-moderation",
        label: "Đánh giá",
        view: "reviews",
      },
      {
        id: "evidence",
        href: "/admin/evidence",
        path: "/admin/evidence",
        label: "Bằng chứng kỹ năng",
      },
    ],
  },
  {
    id: "support",
    href: "/admin/disputes",
    label: "Vụ việc & hỗ trợ",
    icon: "alert",
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
    id: "catalog",
    href: "/admin/skills",
    label: "Danh mục",
    icon: "tag",
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
  { id: "finance", href: "/admin/credits", label: "Tài chính", icon: "card" },
  { id: "settings", href: "/admin/config", label: "Cấu hình", icon: "sliders" },
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
