import type { AdminUser } from "./admin-types";
import { StaffApiError, type PortalApi } from "./client";

export type UserAction = "lock" | "unlock" | "assign" | "remove";
export const userActionLabels: Record<UserAction, string> = {
  lock: "Khóa tài khoản",
  unlock: "Mở khóa tài khoản",
  assign: "Cấp quyền Staff",
  remove: "Gỡ quyền Staff",
};

export function allowedUserActions(
  user: AdminUser,
  actorId?: string,
): UserAction[] {
  const actions: UserAction[] = [];
  if (user.accountStatus === "ACTIVE" && user.userId !== actorId)
    actions.push("lock");
  if (user.accountStatus === "LOCKED") actions.push("unlock");
  if (!user.roles.includes("ADMIN"))
    actions.push(user.roles.includes("STAFF") ? "remove" : "assign");
  return actions;
}

export async function manageUser(
  api: PortalApi,
  userId: string,
  action: UserAction,
  reason: string,
  password: string,
) {
  if (action === "lock" || action === "unlock") {
    await api<null>(`users/${userId}/${action}`, {
      method: "POST",
      body: { reason },
    });
    return;
  }
  const proof = await api<{ reauthToken: string }>("reauthenticate", {
    method: "POST",
    body: { password, purpose: "STAFF_ROLE_CHANGE" },
  });
  if (typeof proof.data?.reauthToken !== "string" || !proof.data.reauthToken)
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  await api<null>(`users/${userId}/roles/staff`, {
    method: action === "assign" ? "PUT" : "DELETE",
    body: { reason, reauthToken: proof.data.reauthToken },
  });
}
