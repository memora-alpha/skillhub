import type { ApiLearningPath } from "../api/learning-paths-contract";

// The server currently returns only INVALID_SCHEDULE_ITEMS, without plan or
// session IDs. Locate problems in the loaded snapshot; never guess an owner
// when no local item explains the server rejection.
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
