import type { ApiLearningPath } from "../api/learning-paths-contract";
import {
  agreementConfirmed,
  editablePath,
  ownConfirmation,
  plansConfirmed,
} from "./policy-api";

type NextAction = { label: string; href: `/paths/${string}` };
export type AgreementProgress = {
  stage: "plans" | "terms" | "schedules" | "finalize" | "sessions" | "closed";
  title: string;
  description: string;
  waiting: string[];
  action?: NextAction;
};

// This is display guidance from an authorized server snapshot, never a transition.
export function agreementProgress(
  path: ApiLearningPath,
  userId?: string,
): AgreementProgress {
  const base = `/paths/${path.id}` as const;
  const waiting: string[] = [];
  if (!userId || ![path.participantAId, path.participantBId].includes(userId))
    return {
      stage: "closed",
      title: "Không thể tiếp tục thỏa thuận",
      description: "Mở lộ trình bằng tài khoản tham gia cuộc trao đổi.",
      waiting,
    };
  if (["CANCELLED", "DISPUTED", "COMPLETED"].includes(path.status)) {
    const descriptions = {
      CANCELLED:
        "Thỏa thuận đã hủy. Không thể tiếp tục xác nhận kế hoạch hoặc lịch.",
      DISPUTED:
        "Thỏa thuận đang có tranh chấp. Xem trạng thái và trao đổi với đối tác.",
      COMPLETED: "Thỏa thuận đã hoàn thành. Bạn có thể xem lại các buổi học.",
    };
    return {
      stage: "closed",
      title: "Trạng thái thỏa thuận",
      description: descriptions[path.status as keyof typeof descriptions],
      waiting,
    };
  }
  if (path.lockedVersion !== null)
    return {
      stage: "sessions",
      title: "Lịch đã chốt · Sẵn sàng học",
      description:
        "Hệ thống đã khóa lịch và tạo các buổi học. Xem lịch để chuẩn bị buổi tiếp theo.",
      waiting,
      action: { label: "Xem các buổi học", href: `${base}/schedules` },
    };
  if (!editablePath(path))
    return {
      stage: "closed",
      title: "Chưa thể tiếp tục",
      description: "Tải lại trạng thái thỏa thuận trước khi thao tác.",
      waiting,
    };

  if (!agreementConfirmed(path)) {
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
      action: mine
        ? undefined
        : { label: "Xem và đồng ý cách học", href: base },
    };
  }
  let action: NextAction | undefined;
  if (!plansConfirmed(path)) {
    const directions =
      path.agreement.exchangeType === "TWO_WAY"
        ? [
            [path.participantAId, path.participantBId],
            [path.participantBId, path.participantAId],
          ]
        : [[path.agreement.teacherId, path.agreement.learnerId]];
    for (const [teacher, learner] of directions) {
      const plan = path.plans.find(
        (p) => p.teacherId === teacher && p.learnerId === learner,
      );
      if (!plan) {
        waiting.push(
          teacher === userId
            ? "Bạn cần tạo kế hoạch mình dạy."
            : "Chờ đối tác tạo kế hoạch họ dạy.",
        );
        if (teacher === userId)
          action ??= {
            label: "Tạo kế hoạch tôi dạy",
            href: `${base}/plans/new`,
          };
      } else if (plan.status !== "CONFIRMED" || !plan.learnerConfirmedAt) {
        waiting.push(
          learner === userId
            ? "Bạn cần xem và xác nhận kế hoạch mình học."
            : "Chờ đối tác xác nhận kế hoạch bạn dạy.",
        );
        if (learner === userId)
          action ??= {
            label: "Xem kế hoạch để xác nhận",
            href: `${base}/plans/${plan.id}`,
          };
      }
    }
    return {
      stage: "plans",
      title: "Bước 2 · Tạo và duyệt lộ trình",
      description:
        path.agreement.exchangeType === "TWO_WAY"
          ? "Cần hai kế hoạch đối ứng. Mỗi người tạo chiều mình dạy và xác nhận chiều mình học."
          : "Người dạy tạo một kế hoạch; người học xem nội dung và xác nhận đúng phiên bản.",
      waiting,
      action,
    };
  }
  if (path.status !== "CONFIRMED") {
    return {
      stage: "plans",
      title: "Bước 2 · Đang cập nhật thỏa thuận",
      description: "Chờ trạng thái xác nhận từ hệ thống trước khi xếp lịch.",
      waiting: ["Đã đủ xác nhận · Đang chờ hệ thống cập nhật trạng thái."],
    };
  }
  for (const plan of path.plans) {
    const schedule = plan.schedule;
    if (!schedule) {
      waiting.push(
        plan.teacherId === userId
          ? "Bạn cần đề xuất lịch cho kế hoạch mình dạy."
          : "Chờ đối tác đề xuất lịch họ dạy.",
      );
      if (plan.teacherId === userId)
        action ??= {
          label: "Đề xuất lịch tôi dạy",
          href: `${base}/schedules/${plan.id}`,
        };
    } else if (
      !["PROPOSED", "PARTIALLY_CONFIRMED"].includes(schedule.status) ||
      schedule.items.length !== plan.totalSessions
    ) {
      waiting.push(
        "Lịch chưa sẵn sàng để chốt. Mở lịch và trao đổi lại với đối tác.",
      );
      action ??= { label: "Xem trạng thái lịch", href: `${base}/schedules` };
    } else if (!ownConfirmation(path, schedule, userId)) {
      waiting.push("Bạn cần xem và xác nhận lịch của từng kế hoạch.");
      action ??= { label: "Xem và xác nhận lịch", href: `${base}/schedules` };
    } else if (
      !schedule.participantAConfirmedAt ||
      !schedule.participantBConfirmedAt
    ) {
      waiting.push("Chờ đối tác xác nhận lịch cùng phiên bản.");
    }
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
