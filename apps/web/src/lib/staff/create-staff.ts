import { strongPassword } from "@/features/auth/password-policy";
import { StaffApiError, type PortalApi } from "./client";

export type StaffAccountDraft = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export function staffAccountError(
  draft: StaffAccountDraft,
): string | undefined {
  const name = draft.fullName.trim();
  if (
    Array.from(name).length < 2 ||
    Array.from(name).length > 100 ||
    !/\p{L}/u.test(name) ||
    !/^[\p{L}\p{M} '\u2019-]+$/u.test(name)
  )
    return "Họ tên cần 2–100 ký tự, gồm chữ, khoảng trắng, dấu nháy hoặc gạch nối.";
  const email = draft.email.trim();
  if (
    email.length < 5 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return "Nhập địa chỉ email hợp lệ.";
  if (!strongPassword(draft.password))
    return "Mật khẩu Staff cần 8–64 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.";
  if (draft.password !== draft.confirmPassword)
    return "Hai mật khẩu Staff chưa khớp.";
}

export async function createStaffAccount(
  api: PortalApi,
  draft: StaffAccountDraft,
  adminPassword: string,
) {
  const error = staffAccountError(draft);
  if (error) throw new Error(error);
  if (!adminPassword)
    throw new Error("Nhập mật khẩu Admin để xác nhận tạo Staff.");
  const proof = await api<{ reauthToken: string }>("reauthenticate", {
    method: "POST",
    body: { password: adminPassword, purpose: "STAFF_ROLE_CHANGE" },
  });
  if (
    typeof proof.data?.reauthToken !== "string" ||
    proof.data.reauthToken.length !== 43
  )
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  const result = await api<{ userId: string }>("users/staff", {
    method: "POST",
    body: {
      fullName: draft.fullName.trim(),
      email: draft.email.trim().toLowerCase(),
      password: draft.password,
      confirmPassword: draft.confirmPassword,
      reauthToken: proof.data.reauthToken,
    },
  });
  if (
    !result.data ||
    typeof result.data.userId !== "string" ||
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(result.data.userId)
  )
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  return result.data.userId;
}
