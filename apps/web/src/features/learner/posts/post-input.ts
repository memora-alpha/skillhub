import { vietnamInstant } from "../sessions/session-policy";
import { validateTagSelection } from "../tags/tag-policy";
import type { PostExtrasValue } from "./post-extras";

export function postExtraInput(value: PostExtrasValue, now = Date.now()) {
  const proposedTags = validateTagSelection(value.tagIds, value.proposedTags);
  if (value.offeredSharingSkillIds.length > 10)
    throw new Error("Chọn tối đa 10 kỹ năng trao đổi.");
  const teachingOverview = value.teachingOverview.trim();
  if (teachingOverview && Array.from(teachingOverview).length < 20)
    throw new Error("Giới thiệu trao đổi cần ít nhất 20 ký tự hoặc để trống.");
  const weeklySlots = value.mode === "weekly" ? value.weeklySlots : [];
  if (weeklySlots.length > 5)
    throw new Error("Chọn tối đa 5 khoảng rảnh tuần.");
  if (value.mode === "weekly") {
    if (/^[+-]/.test(value.timeZone))
      throw new Error("Dùng tên múi giờ IANA, ví dụ Asia/Ho_Chi_Minh.");
    try {
      new Intl.DateTimeFormat("vi", { timeZone: value.timeZone });
    } catch {
      throw new Error("Múi giờ chưa hợp lệ. Ví dụ: Asia/Ho_Chi_Minh.");
    }
    weeklySlots.forEach((slot, index) => {
      if (
        !/^(MON|TUE|WED|THU|FRI|SAT|SUN)$/.test(slot.weekday) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.endTime) ||
        slot.startTime >= slot.endTime
      )
        throw new Error(
          "Khoảng rảnh tuần " +
            (index + 1) +
            " cần giờ kết thúc sau giờ bắt đầu trong cùng ngày.",
        );
      if (
        weeklySlots.some(
          (other, i) =>
            i < index &&
            other.weekday === slot.weekday &&
            other.startTime < slot.endTime &&
            other.endTime > slot.startTime,
        )
      )
        throw new Error("Các khoảng rảnh hằng tuần đang chồng nhau.");
    });
  }
  const preferredSlots =
    value.mode === "slots"
      ? value.preferredSlots.map((slot, index) => {
          const startAt = vietnamInstant(slot.startAt),
            endAt = vietnamInstant(slot.endAt);
          if (
            Date.parse(startAt) <= now ||
            Date.parse(endAt) <= Date.parse(startAt)
          )
            throw new Error(
              "Khoảng ngày giờ " +
                (index + 1) +
                " cần ở tương lai, kết thúc sau bắt đầu.",
            );
          return { startAt, endAt };
        })
      : [];
  if (preferredSlots.length > 5)
    throw new Error("Chọn tối đa 5 khoảng ngày giờ.");
  if (
    preferredSlots.some((slot, index) =>
      preferredSlots.some(
        (other, i) =>
          i < index && other.startAt < slot.endAt && other.endAt > slot.startAt,
      ),
    )
  )
    throw new Error("Các khoảng ngày giờ đang chồng nhau.");
  const expiresAt = value.expiresAt ? vietnamInstant(value.expiresAt) : null;
  if (expiresAt && Date.parse(expiresAt) <= now)
    throw new Error("Thời điểm hết hạn cần ở tương lai.");
  return {
    tagIds: value.tagIds,
    proposedTags,
    offeredSharingSkillIds: value.offeredSharingSkillIds,
    teachingOverview: teachingOverview || null,
    verifiedTeacherOnly: value.verifiedTeacherOnly,
    preferredAvailability:
      value.mode === "weekly"
        ? { timeZone: value.timeZone, weeklySlots }
        : null,
    preferredSlots,
    expiresAt,
  };
}
