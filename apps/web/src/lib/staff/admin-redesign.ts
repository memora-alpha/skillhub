export function isRedesignedAdminPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/staff");
}
