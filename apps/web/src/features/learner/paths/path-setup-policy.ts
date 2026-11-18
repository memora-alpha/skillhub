import { UserApiError, type UserRequestOptions } from "../api/client";
import type { LearningPath, Reply } from "../types";
import { commitmentSnapshot, readFinalizePath } from "./finalize-recovery";

export const setupSteps = [
  { key: "overview", label: "Thỏa thuận" },
  { key: "plans", label: "Kế hoạch học" },
  { key: "schedule", label: "Lịch học" },
  { key: "finalize", label: "Xem lại & chốt lịch" },
] as const;
export type PathSetupStep = (typeof setupSteps)[number]["key"];

export function pathSetupProgress(path: LearningPath) {
  const terms: string[] = [];
  if (
    !path.agreement.participantAConfirmedAt ||
    !path.agreement.participantBConfirmedAt
  )
    terms.push("Cần cả hai bên xác nhận thỏa thuận hiện tại.");
  const plans: string[] = [];
  const twoWay = path.agreement.exchangeType === "TWO_WAY";
  if (path.plans.length !== (twoWay ? 2 : 1))
    plans.push(
      twoWay
        ? "Cần đủ hai kế hoạch, mỗi người hướng dẫn một kế hoạch."
        : "Người hướng dẫn cần tạo một kế hoạch học.",
    );
  const directions = twoWay
    ? [
        [path.participantAId, path.participantBId],
        [path.participantBId, path.participantAId],
      ]
    : [[path.agreement.teacherId, path.agreement.learnerId]];
  if (
    path.plans.length &&
    !directions.every(
      ([teacher, learner]) =>
        teacher &&
        learner &&
        path.plans.some(
          (plan) => plan.teacherId === teacher && plan.learnerId === learner,
        ),
    )
  )
    plans.push(
      "Kế hoạch cần đúng người hướng dẫn và người học trong thỏa thuận.",
    );
  for (const [index, plan] of path.plans.entries()) {
    if (!plan.learnerConfirmedAt || plan.status !== "CONFIRMED")
      plans.push(
        `Kế hoạch ${index + 1} cần người học xác nhận phiên bản hiện tại.`,
      );
  }
  if (!terms.length && !plans.length && path.status !== "CONFIRMED")
    plans.push(
      "Lộ trình chưa được hệ thống ghi nhận đủ xác nhận. Vui lòng kiểm tra lại.",
    );
  const schedules: string[] = [];
  for (const [index, plan] of path.plans.entries()) {
    if (!plan.schedule) {
      schedules.push(`Kế hoạch ${index + 1} chưa có lịch học.`);
      continue;
    }
    const schedule = plan.schedule;
    if (!schedule.participantAConfirmedAt || !schedule.participantBConfirmedAt)
      schedules.push(`Lịch của kế hoạch ${index + 1} cần cả hai bên xác nhận.`);
    const numbers = new Set(schedule.items.map((item) => item.sessionNo));
    if (
      schedule.items.length !== plan.totalSessions ||
      numbers.size !== plan.totalSessions ||
      !Array.from({ length: plan.totalSessions }, (_, i) => i + 1).every((n) =>
        numbers.has(n),
      )
    )
      schedules.push(
        `Lịch của kế hoạch ${index + 1} chưa đủ các buổi trong kế hoạch.`,
      );
  }
  const issues = [terms, plans, schedules, []] as const;
  const firstIncomplete = issues
    .slice(0, 3)
    .findIndex((items) => items.length > 0);
  return { issues, availableStep: firstIncomplete < 0 ? 3 : firstIncomplete };
}

type Request = <T>(
  path: string,
  options?: UserRequestOptions,
) => Promise<Reply<T>>;

/** Reads persisted confirmations; only the existing finalize command can hold Credit. */
export async function checkSetupAdvance(
  request: Request,
  pathId: string,
  target: number,
) {
  if (!Number.isInteger(target) || target < 1 || target > 3)
    throw new Error("Bước chuyển tiếp chưa hợp lệ.");
  const path = await readFinalizePath(request, pathId);
  if (path.lockedVersion !== null) return { path, issues: [] };
  if (!["PROPOSED", "PARTIALLY_CONFIRMED", "CONFIRMED"].includes(path.status))
    return {
      path,
      issues: ["Lộ trình hiện không còn ở trạng thái thiết lập."],
    };
  const issues = pathSetupProgress(path).issues.slice(0, target).flat();
  if (issues.length || target < 3) return { path, issues };
  const validation = (
    await request<{ pathId: string; version: number; ready: boolean }>(
      `learning-paths/${pathId}/final-validation`,
      { method: "POST", body: {} },
    )
  ).data;
  if (
    validation?.pathId !== pathId ||
    validation.version !== path.currentVersion ||
    validation.ready !== true
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  const latest = await readFinalizePath(request, pathId);
  if (
    latest.lockedVersion === null &&
    commitmentSnapshot(latest) !== commitmentSnapshot(path)
  )
    return {
      path: latest,
      issues: [
        "Nội dung vừa được cập nhật. Vui lòng xem lại và bấm Tiếp theo lần nữa.",
      ],
    };
  return { path: latest, issues: [] };
}
