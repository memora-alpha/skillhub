const pages = [
  "/admin/audit",
  "/admin/learning-paths",
  "/admin/disputes",
  "/admin/learning-changes",
  "/admin/content",
  "/admin/credits",
  "/admin/notifications",
];

export function isRedesignedAdminPath(pathname: string) {
  return pages.some(
    (page) => pathname === page || pathname.startsWith(page + "/"),
  );
}
