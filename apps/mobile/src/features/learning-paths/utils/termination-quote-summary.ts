const reasons: Record<string, string> = {
  CREDIT_NOT_HELD: "Lộ trình chưa tạm giữ Credit.",
  TERMINATION_POLICY_NOT_APPROVED: "Chờ duyệt chính sách Credit.",
  TERMINATION_BLOCKED_BY_DISPUTE: "Chờ giải quyết tranh chấp.",
  TERMINATION_SESSION_RULING_REQUIRED:
    "Chờ kết luận các buổi học còn vướng mắc.",
  TERMINATION_USE_FINAL_SETTLEMENT:
    "Các buổi đã hoàn tất. Về bước Hoàn tất để xem quyết toán.",
  SESSION_CREDIT_SNAPSHOT_MISSING:
    "Lộ trình cũ chưa có dữ liệu tính Credit khi hủy. Cần nhân viên hỗ trợ.",
  SESSION_CREDIT_POLICY_REVIEW_REQUIRED:
    "Chính sách Credit của lộ trình cần được nhân viên xem xét.",
  SESSION_CREDIT_SNAPSHOT_INVALID:
    "Dữ liệu Credit cần được nhân viên kiểm tra.",
  SESSION_CREDIT_SNAPSHOT_MISMATCH:
    "Dữ liệu Credit cần được nhân viên kiểm tra.",
  TERMINATION_ALLOCATION_MISMATCH: "Khoản tạm giữ cần được nhân viên kiểm tra.",
};
export function terminationQuoteNotes(codes: string[]) {
  return [
    ...new Set(
      codes.map(
        (code) =>
          reasons[code] ??
          "Cần nhân viên kiểm tra trước khi quyết toán Credit.",
      ),
    ),
  ];
}
