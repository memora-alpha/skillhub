import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import {
  agreementConfirmed,
  editablePath,
  ownConfirmation,
  plansConfirmed,
  canEditSchedule,
  scheduleIsComplete,
} from "./policy-api";

type NextAction = { label: string; href: `/paths/${string}` };
export type AgreementProgress = {
  stage: "plans" | "terms" | "schedules" | "finalize" | "sessions" | "closed";
  title: string;
  description: string;
  waiting: string[];
  action?: NextAction;
};

function closedProgress(title: string, description: string): AgreementProgress {
  return {
    stage: "closed",
    title,
    description,
    waiting: [],
  };
}

function terminalProgress(
  path: ApiLearningPath,
): AgreementProgress | undefined {
  switch (path.status) {
    case "CANCELLED":
      return closedProgress(
        "Trạng thái thỏa thuận",
        "Thỏa thuận đã hủy. Không thể tiếp tục xác nhận kế hoạch hoặc lịch.",
      );
    case "DISPUTED":
      return closedProgress(
        "Trạng thái thỏa thuận",
        "Thỏa thuận đang có tranh chấp. Xem trạng thái và trao đổi với đối tác.",
      );
    case "COMPLETED":
      return closedProgress(
        "Trạng thái thỏa thuận",
        "Thỏa thuận đã hoàn thành. Bạn có thể xem lại các buổi học.",
      );
    default:
      return undefined;
  }
}

function termsProgress(
  path: ApiLearningPath,
  userId: string,
  base: `/paths/${string}`,
): AgreementProgress {
  const mine = ownConfirmation(path, path.agreement, userId);
  return {
    stage: "terms",
    title: "Bước 1 · Thống nhất cách học",
    description:
      "Hai bên xác nhận hình thức, vai trò và Credit trước khi tạo lộ trình.",
    waiting: [
      mine
        ? "Bạn đã xác nhận · Chờ đối tác đồng ý cách học."
        : "Bạn cần xem và đồng ý cách học của phiên bản hiện tại.",
    ],
    action: mine ? undefined : { label: "Xem và đồng ý cách học", href: base },
  };
}

function planDirections(
  path: ApiLearningPath,
): [string | null, string | null][] {
  if (path.agreement.exchangeType === "TWO_WAY")
    return [
      [path.participantAId, path.participantBId],
      [path.participantBId, path.participantAId],
    ];
  return [[path.agreement.teacherId, path.agreement.learnerId]];
}

function planDirectionProgress(
  path: ApiLearningPath,
  teacher: string | null,
  learner: string | null,
  userId: string,
  base: `/paths/${string}`,
) {
  const plan = path.plans.find(
    (item) => item.teacherId === teacher && item.learnerId === learner,
  );
  if (!plan) {
    const mine = teacher === userId;
    return {
      waiting: mine
        ? "Bạn cần tạo kế hoạch mình dạy."
        : "Chờ đối tác tạo kế hoạch họ dạy.",
      action: mine
        ? { label: "Tạo kế hoạch tôi dạy", href: `${base}/plans/new` as const }
        : undefined,
    };
  }
  if (plan.status === "CONFIRMED" && plan.learnerConfirmedAt) return null;
  const mine = learner === userId;
  return {
    waiting: mine
      ? "Bạn cần xem và xác nhận kế hoạch mình học."
      : "Chờ đối tác xác nhận kế hoạch bạn dạy.",
    action: mine
      ? {
          label: "Xem kế hoạch để xác nhận",
          href: `${base}/plans/${plan.id}` as const,
        }
      : undefined,
  };
}

function plansProgress(
  path: ApiLearningPath,
  userId: string,
  base: `/paths/${string}`,
): AgreementProgress {
  const waiting: string[] = [];
  let action: NextAction | undefined;
  for (const [teacher, learner] of planDirections(path)) {
    const direction = planDirectionProgress(
      path,
      teacher,
      learner,
      userId,
      base,
    );
    if (!direction) continue;
    waiting.push(direction.waiting);
    action ??= direction.action;
  }
  const twoWay = path.agreement.exchangeType === "TWO_WAY";
  return {
    stage: "plans",
    title: "Bước 2 · Tạo và duyệt lộ trình",
    description: twoWay
      ? "Cần hai kế hoạch đối ứng. Mỗi người tạo chiều mình dạy và xác nhận chiều mình học."
      : "Người dạy tạo một kế hoạch; người học xem nội dung và xác nhận đúng phiên bản.",
    waiting,
    action,
  };
}

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

function schedulesProgress(
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

// This is display guidance from an authorized server snapshot, never a transition.
export function agreementProgress(
  path: ApiLearningPath,
  userId?: string,
): AgreementProgress {
  const base = `/paths/${path.id}` as const;
  const participant =
    !!userId && [path.participantAId, path.participantBId].includes(userId);
  if (!participant)
    return closedProgress(
      "Không thể tiếp tục thỏa thuận",
      "Mở lộ trình bằng tài khoản tham gia cuộc trao đổi.",
    );
  const terminal = terminalProgress(path);
  if (terminal) return terminal;
  if (path.lockedVersion !== null)
    return {
      stage: "sessions",
      title: "Lịch đã chốt · Sẵn sàng học",
      description:
        "Hệ thống đã khóa lịch và tạo các buổi học. Xem lịch để chuẩn bị buổi tiếp theo.",
      waiting: [],
      action: { label: "Xem các buổi học", href: `${base}/schedules` },
    };
  if (!editablePath(path))
    return closedProgress(
      "Chưa thể tiếp tục",
      "Tải lại trạng thái thỏa thuận trước khi thao tác.",
    );
  if (!agreementConfirmed(path)) return termsProgress(path, userId!, base);
  if (!plansConfirmed(path)) return plansProgress(path, userId!, base);
  if (path.status !== "CONFIRMED")
    return {
      stage: "plans",
      title: "Bước 2 · Đang cập nhật thỏa thuận",
      description: "Chờ trạng thái xác nhận từ hệ thống trước khi xếp lịch.",
      waiting: ["Đã đủ xác nhận · Đang chờ hệ thống cập nhật trạng thái."],
    };
  return schedulesProgress(path, userId!, base);
}
