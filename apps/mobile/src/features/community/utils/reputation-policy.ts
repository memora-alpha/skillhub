import type { Reputation } from "../api/community-api";

export function hasRequestRestriction(data: Reputation) {
  return data.activeRestrictions.some((item) =>
    ["ALL", "CREATE_NEW_ACTIVITY", "learning-request:create"].includes(
      item.scope,
    ),
  );
}

export function canCreateRequest(policy: {
  data?: Reputation;
  pending: boolean;
  needsCheck: boolean;
  error?: unknown;
  query: {
    isFetchedAfterMount: boolean;
    isFetching: boolean;
    error?: unknown;
    denied?: unknown;
  };
}) {
  return (
    !!policy.data &&
    policy.query.isFetchedAfterMount &&
    !policy.query.error &&
    !policy.query.denied &&
    !policy.query.isFetching &&
    !policy.error &&
    !policy.needsCheck &&
    !policy.pending &&
    !hasRequestRestriction(policy.data)
  );
}

export function restrictionDeadline(
  endsAt: string,
  needsPolicy: boolean,
  now = Date.now(),
) {
  const end = new Date(endsAt);
  if (end.getTime() > now) return `Hạn chế đến ${end.toLocaleString("vi-VN")}.`;
  return needsPolicy
    ? "Thời hạn đã qua; tài khoản vẫn cần xác nhận chính sách."
    : "Thời hạn đã qua; hệ thống vẫn ghi nhận hạn chế. Hãy tải lại để kiểm tra.";
}
