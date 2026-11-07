import type { Prisma } from "../../../generated/prisma/client";

export const recoveryPolicy = [
  "Xác nhận trung thực việc tham gia và hoàn thành buổi học.",
  "Khi không thể tham gia, thông báo cho đối phương và dùng chức năng đổi lịch hoặc hủy.",
  "Không tạo hoạt động giả để nhận điểm. Gửi báo cáo trung thực.",
  "Tăng điểm không thay đổi thời hạn hạn chế quyền đang áp dụng.",
];

export function effectiveRestriction(
  now: Date,
): Prisma.UserRestrictionWhereInput {
  return {
    revokedAt: null,
    startsAt: { lte: now },
    OR: [
      { endsAt: { gt: now } },
      { policyRequired: true, policyAcknowledgedAt: null },
    ],
  };
}
