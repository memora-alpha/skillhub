import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import type { AgreementProgress, NextAction } from "./progression";
import {
  canEditSchedule,
  scheduleIsComplete,
  ownConfirmation,
} from "./policy-api";

function scheduleDirectionProgress(
  path: ApiLearningPath,
  plan: ApiLearningPlan,
  userId: string,
  base: `/paths/${string}`,
) {
  const schedule = plan.schedule;
  if (!schedule) {
    const mine = plan.teacherId === userId;
    return {
      waiting: mine
        ? "Bạn cần đề xuất lịch cho kế hoạch mình dạy."
        : "Chờ đối tác đề xuất lịch họ dạy.",
      action: mine
        ? {
            label: "Đề xuất lịch tôi dạy",
            href: `${base}/schedules/${plan.id}` as const,
          }
        : undefined,
    };
  }
  const editableStatus = [
    "PROPOSED",
    "PARTIALLY_CONFIRMED",
    "NEEDS_REVISION",
  ].includes(schedule.status);
  if (!editableStatus || !scheduleIsComplete(plan)) {
    const editable = canEditSchedule(path, plan, userId);
    return {
      waiting: editable
        ? "Bạn cần điều chỉnh lịch đủ các buổi của lộ trình."
        : "Lịch chưa đầy đủ hoặc cần điều chỉnh. Chờ người dạy cập nhật lịch.",
      action: editable
        ? {
            label: "Điều chỉnh lịch tôi dạy",
            href: `${base}/schedules/${plan.id}` as const,
          }
        : { label: "Xem trạng thái lịch", href: `${base}/schedules` as const },
    };
  }
  if (!ownConfirmation(path, schedule, userId))
    return {
      waiting: "Bạn cần xem và xác nhận lịch của từng kế hoạch.",
      action: {
        label: "Xem và xác nhận lịch",
        href: `${base}/schedules` as const,
      },
    };
  if (!schedule.participantAConfirmedAt || !schedule.participantBConfirmedAt)
    return { waiting: "Chờ đối tác xác nhận lịch cùng phiên bản." };
  return null;
}

export function schedulesProgress(
  path: ApiLearningPath,
  userId: string,
  base: `/paths/${string}`,
): AgreementProgress {
  const waiting: string[] = [];
  let action: NextAction | undefined;
  for (const plan of path.plans) {
    const direction = scheduleDirectionProgress(path, plan, userId, base);
    if (!direction) continue;
    waiting.push(direction.waiting);
    action ??= direction.action;
  }
  if (waiting.length)
    return {
      stage: "schedules",
      title: "Bước 3 · Thống nhất lịch học",
      description:
        "Mỗi kế hoạch có lịch riêng. Cả hai cùng xác nhận từng lịch; chưa tạm giữ Credit ở bước này.",
      waiting: [...new Set(waiting)],
      action,
    };
  return {
    stage: "finalize",
    title: "Bước 3 · Kiểm tra và chốt lịch",
    description:
      "Đã đủ xác nhận. Hệ thống cần kiểm tra lịch trùng và số dư trước khi tạm giữ Credit, khóa lịch và tạo buổi học.",
    waiting,
    action: { label: "Xem và chốt lịch học", href: `${base}/schedules` },
  };
}
