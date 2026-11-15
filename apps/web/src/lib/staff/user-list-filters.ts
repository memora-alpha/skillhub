import type { AdminUser } from "./admin-types";

export const userRoles = [
  { value: "USER", label: "Người dùng" },
  { value: "STAFF", label: "Nhân viên" },
  { value: "ADMIN", label: "Quản trị viên" },
];
export const userStatuses = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "LOCKED", label: "Đã khóa" },
  { value: "PENDING_VERIFICATION", label: "Chờ xác minh" },
  { value: "SUSPENDED", label: "Tạm đình chỉ" },
  { value: "DEACTIVATED", label: "Đã vô hiệu hóa" },
];

function validDate(value: string) {
  const timestamp = Date.parse(value + "T00:00:00Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) > 0 &&
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}
export function userCreatedDateError(from: string, to: string) {
  if ((from && !validDate(from)) || (to && !validDate(to)))
    return "Ngày tạo chưa hợp lệ. Vui lòng chọn lại ngày.";
  if (from && to && from > to)
    return "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
  return "";
}

/** The users API supports role/status only. Search and dates filter loaded pages. */
export function filterLoadedUsers(
  users: AdminUser[],
  query: string,
  from: string,
  to: string,
) {
  if (userCreatedDateError(from, to)) return [];
  const needle = query.trim().toLocaleLowerCase("vi");
  const start = from ? Date.parse(from + "T00:00:00+07:00") : -Infinity;
  const end = to ? Date.parse(to + "T23:59:59.999+07:00") : Infinity;
  return users.filter((user) => {
    const matchesQuery = `${user.fullName} ${user.maskedEmail} ${user.userId}`
      .toLocaleLowerCase("vi")
      .includes(needle);
    if (!from && !to) return matchesQuery;
    const createdAt = Date.parse(user.createdAt);
    return matchesQuery && createdAt >= start && createdAt <= end;
  });
}
