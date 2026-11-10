import type { ApiLearningPath } from "../api/learning-paths-contract";
import type { InvalidScheduleDetails } from "@/lib/http/scheduling-error";

// Compatibility estimate for APIs without validated details. It is never used
// to replace a server reason or attach a stale error to the current schedule.
export function invalidScheduleItems(path: ApiLearningPath, now = Date.now()) {
  return path.plans.flatMap((plan) => {
    const items = (plan.schedule?.items ?? []).flatMap((item) => {
      const start = Date.parse(item.startAt);
      const end = Date.parse(item.endAt);
      const minutes = (end - start) / 60_000;
      const reasons: string[] = [];
      if (!Number.isFinite(start) || !Number.isFinite(end))
        reasons.push("ngày hoặc giờ không hợp lệ");
      else {
        if (start <= now) reasons.push("giờ bắt đầu đã qua");
        if (minutes <= 0) reasons.push("giờ kết thúc phải sau giờ bắt đầu");
        else if (minutes < 60 || minutes > 180)
          reasons.push(`thời lượng ${minutes} phút, cần từ 60 đến 180 phút`);
      }
      return reasons.length ? [{ ...item, reasons }] : [];
    });
    return items.length ? [{ plan, items }] : [];
  });
}

export function scheduleValidationKey(path: ApiLearningPath) {
  return JSON.stringify({
    id: path.id,
    version: path.currentVersion,
    plans: path.plans.map((plan) => ({
      id: plan.id,
      version: plan.version,
      teacherId: plan.teacherId,
      learnerId: plan.learnerId,
      schedule: plan.schedule,
    })),
  });
}

function serverReasons(
  item: InvalidScheduleDetails["invalidItems"][number],
  policy: InvalidScheduleDetails["durationMinutes"],
) {
  const minutes = (Date.parse(item.endAt) - Date.parse(item.startAt)) / 60_000;
  return item.reasons.map((reason) => {
    switch (reason) {
      case "START_NOT_IN_FUTURE":
        return "giờ bắt đầu đã qua";
      case "END_NOT_AFTER_START":
        return "giờ kết thúc phải sau giờ bắt đầu";
      case "DURATION_TOO_SHORT":
        return `thời lượng ${minutes} phút, tối thiểu ${policy.min} phút`;
      case "DURATION_TOO_LONG":
        return `thời lượng ${minutes} phút, tối đa ${policy.max} phút`;
    }
  });
}

export function serverInvalidScheduleItems(
  path: ApiLearningPath,
  details: InvalidScheduleDetails,
) {
  const issues: ReturnType<typeof invalidScheduleItems> = [];
  for (const item of details.invalidItems) {
    const plan = path.plans.find((candidate) => candidate.id === item.planId);
    const schedule = plan?.schedule;
    const slot = schedule?.items.find(
      (candidate) => candidate.sessionNo === item.sessionNo,
    );
    if (
      !plan ||
      !schedule ||
      !slot ||
      plan.version !== item.planVersion ||
      plan.teacherId !== item.teacherId ||
      plan.learnerId !== item.learnerId ||
      schedule.id !== item.scheduleId ||
      schedule.version !== item.scheduleVersion ||
      Date.parse(slot.startAt) !== Date.parse(item.startAt) ||
      Date.parse(slot.endAt) !== Date.parse(item.endAt)
    )
      return undefined;
    let issue = issues.find((candidate) => candidate.plan.id === plan.id);
    if (!issue) {
      issue = { plan, items: [] };
      issues.push(issue);
    }
    issue.items.push({
      sessionNo: item.sessionNo,
      startAt: item.startAt,
      endAt: item.endAt,
      reasons: serverReasons(item, details.durationMinutes),
    });
  }
  return issues;
}
