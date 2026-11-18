export type MaterialOwnershipStatus =
  "own" | "free" | "purchased" | "unpurchased" | "checking" | "unverified";

export function materialOwnershipStatus({
  own,
  free,
  purchased,
  resolved,
  error,
}: {
  own: boolean;
  free: boolean;
  purchased: boolean;
  resolved: boolean;
  error: boolean;
}): MaterialOwnershipStatus {
  if (own) return "own";
  if (purchased && !error) return "purchased";
  if (free) return "free";
  if (error) return "unverified";
  if (!resolved) return "checking";
  return "unpurchased";
}

export const materialOwnershipLabels: Record<MaterialOwnershipStatus, string> =
  {
    own: "Tài liệu của bạn",
    free: "Miễn phí",
    purchased: "Đã mua",
    unpurchased: "Chưa mua",
    checking: "Đang kiểm tra giao dịch…",
    unverified: "Chưa xác minh trạng thái mua",
  };
