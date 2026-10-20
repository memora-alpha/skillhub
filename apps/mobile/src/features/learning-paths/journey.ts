import type { ApiLearningPath } from "./api/learning-paths-contract";
import {
  canConfirmPlan,
  canConfirmSchedule,
  canCreatePlan,
  canSchedule,
  canValidateForFinalize,
  editablePath,
  ownConfirmation,
  pathStatusLabel,
} from "./policy-api";

export type LearningJourney = {
  step: 2 | 3 | 4;
  title: string;
  description: string;
  waiting: string[];
  action?: { label: string; href: string };
};

/** Presentation only; every action uses the existing participant/version policy. */
export function learningJourney(
  path: ApiLearningPath,
  userId?: string,
): LearningJourney {
  const result: LearningJourney = {
    step: 2,
    title: "Đang chờ người trao đổi",
    description:
      "Bạn đã hoàn tất phần hiện tại. Có thể tiếp tục trao đổi qua Chat.",
    waiting: [],
  };
  if (!userId || ![path.participantAId, path.participantBId].includes(userId))
    return {
      ...result,
      title: "Không thể thao tác",
      description: "Mở việc học từ tài khoản tham gia.",
    };
  if (!editablePath(path))
    return {
      ...result,
      step: path.lockedVersion === null ? 2 : 4,
      title: pathStatusLabel[path.status],
      description:
        path.lockedVersion === null
          ? "Việc học hiện không ở bước thống nhất nội dung và lịch."
          : "Lịch và Credit đã được ghi nhận. Xem các buổi học bên dưới.",
      action:
        path.lockedVersion === null
          ? undefined
          : {
              label: "Xem lịch đã chốt",
              href: `/paths/${path.id}/schedules`,
            },
    };
  const required = path.agreement.exchangeType === "TWO_WAY" ? 2 : 1;
  if (
    path.plans.length < required &&
    (path.agreement.exchangeType === "TWO_WAY" ||
      path.agreement.teacherId !== userId) &&
    !path.plans.some((p) => p.teacherId !== userId)
  )
    result.waiting.push("Người trao đổi tạo nội dung phần họ dạy.");
  if (path.plans.some((p) => p.teacherId === userId && !p.learnerConfirmedAt))
    result.waiting.push("Người trao đổi đồng ý nội dung bạn dạy.");
  const otherConfirmed =
    path.participantAId === userId
      ? path.agreement.participantBConfirmedAt
      : path.agreement.participantAConfirmedAt;
  if (!otherConfirmed)
    result.waiting.push("Người trao đổi đồng ý hình thức và Credit.");
  if (canCreatePlan(path, userId))
    return {
      ...result,
      title: "Thêm nội dung bạn sẽ dạy",
      description:
        "Chọn kỹ năng, mục tiêu và nội dung từng buổi để người trao đổi xem và đồng ý.",
      action: {
        label: "Soạn nội dung bạn dạy",
        href: `/paths/${path.id}/plans/new`,
      },
    };
  const toReview = path.plans.find((p) => canConfirmPlan(path, p, userId));
  if (toReview)
    return {
      ...result,
      title: "Xem nội dung bạn sẽ học",
      description:
        "Người trao đổi đã gửi nội dung. Bạn cần xem và đồng ý trước khi chọn lịch.",
      action: {
        label: "Xem nội dung để đồng ý",
        href: `/paths/${path.id}/plans/${toReview.id}`,
      },
    };
  if (!ownConfirmation(path, path.agreement, userId))
    return {
      ...result,
      title: "Xem lại hình thức và Credit",
      description:
        "Đọc phần hình thức và Credit bên dưới rồi xác nhận riêng phần này.",
    };
  if (path.status !== "CONFIRMED") return result;
  result.step = 3;
  result.waiting = [];
  if (
    path.plans.some(
      (plan) =>
        plan.schedule &&
        !["PROPOSED", "PARTIALLY_CONFIRMED"].includes(plan.schedule.status),
    )
  )
    return {
      ...result,
      title: "Lịch cần được xem lại",
      description:
        "Có lịch chưa thể xác nhận hoặc đã kết thúc hiệu lực. Hai bạn cần trao đổi lại trước khi tiếp tục chốt lịch.",
      action: {
        label: "Trao đổi với người trao đổi",
        href: `/chat/${path.conversationId}`,
      },
    };
  for (const plan of path.plans) {
    if (!plan.schedule && plan.teacherId !== userId)
      result.waiting.push("Người trao đổi chọn lịch cho phần họ dạy.");
    else if (
      plan.schedule &&
      !ownConfirmation(
        path,
        plan.schedule,
        path.participantAId === userId
          ? path.participantBId
          : path.participantAId,
      )
    )
      result.waiting.push("Người trao đổi đồng ý lịch học đã đề xuất.");
  }
  const toSchedule = path.plans.find((p) => canSchedule(path, p, userId));
  if (toSchedule)
    return {
      ...result,
      title: "Chọn lịch cho phần bạn dạy",
      description:
        "Chọn ngày, giờ và thời lượng từng buổi, sau đó gửi để cả hai xác nhận.",
      action: {
        label: "Chọn ngày giờ học",
        href: `/paths/${path.id}/schedules/${toSchedule.id}`,
      },
    };
  if (path.plans.some((p) => canConfirmSchedule(path, p, userId)))
    return {
      ...result,
      title: "Xem và đồng ý lịch học",
      description:
        "Kiểm tra giờ học của từng phần. Mỗi lịch cần xác nhận riêng của cả hai.",
      action: {
        label: "Xem lịch cần xác nhận",
        href: `/paths/${path.id}/schedules`,
      },
    };
  if (canValidateForFinalize(path))
    return {
      ...result,
      step: 4,
      title: "Sẵn sàng chốt lịch học",
      description:
        "Nội dung và lịch đã đủ xác nhận. Xem lại khoản Credit trước khi chốt.",
      action: { label: "Xem lại và chốt lịch", href: `/paths/${path.id}/hold` },
    };
  return {
    ...result,
    action: {
      label: "Xem tình trạng lịch",
      href: `/paths/${path.id}/schedules`,
    },
    description:
      "Lịch chỉ được chốt khi đủ xác nhận. Xem tình trạng từng phần hoặc tải cập nhật từ người trao đổi.",
  };
}
