import type { LearningPath, Plan, Slot } from "./types";
export function plansConfirmed(path: LearningPath): boolean {
  const roles =
    path.type === "TWO_WAY"
      ? path.plans.length === 2 &&
        path.plans.some((p) => p.teacher === "me") &&
        path.plans.some((p) => p.teacher === "partner")
      : path.plans.length === 1 && path.plans[0]?.teacher === path.teacher;
  return (
    roles &&
    path.plans.every(
      (p) =>
        p.teacher !== p.learner &&
        p.outline.length > 0 &&
        p.learnerVersion === p.version,
    )
  );
}
export function agreementConfirmed(path: LearningPath): boolean {
  return (
    plansConfirmed(path) &&
    path.meVersion === path.version &&
    path.partnerVersion === path.version
  );
}
export function editOwnPlan(
  path: LearningPath,
  planId: string,
  values: Pick<Plan, "skill" | "goal" | "outline">,
): LearningPath | undefined {
  const plan = path.plans.find((p) => p.id === planId);
  if (!plan || plan.teacher !== "me" || path.status !== "PROPOSED") return;
  return {
    ...path,
    version: path.version + 1,
    meVersion: undefined,
    partnerVersion: undefined,
    plans: path.plans.map((p) =>
      p.id === planId
        ? {
            ...p,
            ...values,
            version: p.version + 1,
            learnerVersion: undefined,
            revision: undefined,
            schedule: undefined,
          }
        : { ...p, schedule: undefined },
    ),
  };
}
export function validSlots(
  slots: Slot[],
  count: number,
  now = Date.now(),
): string | undefined {
  if (slots.length !== count)
    return `Lịch cần đúng ${count} buổi của kế hoạch này.`;
  if (
    slots.some(
      (s) =>
        !Number.isFinite(Date.parse(s.startAt)) || Date.parse(s.startAt) <= now,
    )
  )
    return "Chọn ngày giờ trong tương lai.";
  if (
    slots.some(
      (s) =>
        !Number.isInteger(s.duration) || s.duration < 60 || s.duration > 180,
    )
  )
    return "Mỗi buổi kéo dài 60–180 phút.";
  if (hasConflict(slots)) return "Các buổi học bị trùng giờ.";
}
export function hasConflict(slots: Slot[]): boolean {
  const sorted = [...slots].sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt),
  );
  return sorted.some(
    (s, i) =>
      i > 0 &&
      Date.parse(s.startAt) <
        Date.parse(sorted[i - 1]!.startAt) + sorted[i - 1]!.duration * 60000,
  );
}
export function finalValidation(
  path: LearningPath,
  balances: { me: number; partner: number },
  now = Date.now(),
  occupied: Slot[] = [],
): string | undefined {
  if (path.status !== "PROPOSED")
    return "Lộ trình không còn ở trạng thái thương lượng.";
  if (!agreementConfirmed(path))
    return "Chưa đủ xác nhận kế hoạch và điều khoản cùng phiên bản.";
  if (
    !/^\d{1,10}(\.\d{1,2})?$/.test(path.credit) ||
    Number(path.credit) <= 0 ||
    (path.type === "TWO_WAY" && Number(path.credit) < 20)
  )
    return "Credit chưa hợp lệ cho hình thức học.";
  for (const plan of path.plans) {
    const schedule = plan.schedule;
    if (
      !schedule ||
      schedule.meVersion !== schedule.version ||
      schedule.partnerVersion !== schedule.version
    )
      return "Cần hai bên xác nhận từng lịch cùng phiên bản.";
    const error = validSlots(schedule.slots, plan.outline.length, now);
    if (error) return error;
  }
  if (hasConflict(path.plans.flatMap((p) => p.schedule?.slots ?? [])))
    return "Lịch của hai kế hoạch bị trùng nhau.";
  const proposed = path.plans.flatMap((p) => p.schedule?.slots ?? []);
  if (
    proposed.some((slot) =>
      occupied.some(
        (busy) =>
          Date.parse(slot.startAt) <
            Date.parse(busy.startAt) + busy.duration * 60000 &&
          Date.parse(slot.startAt) + slot.duration * 60000 >
            Date.parse(busy.startAt),
      ),
    )
  )
    return "Lịch bị trùng với buổi học đã khóa của lộ trình khác.";
  const payers =
    path.type === "TWO_WAY"
      ? (["me", "partner"] as const)
      : ([path.teacher === "me" ? "partner" : "me"] as const);
  if (payers.some((p) => balances[p] < Number(path.credit)))
    return "Số dư mẫu không đủ để tạm giữ Credit.";
}
export function canReschedule(startAt: string, now = Date.now()): boolean {
  return Date.parse(startAt) - now >= 60 * 60000;
}
