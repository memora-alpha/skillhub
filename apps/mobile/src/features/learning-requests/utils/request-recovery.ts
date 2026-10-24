import { AppError } from "@/lib/http/errors";
import { requestDefaults, type RequestDraft } from "../schemas/request-form";
import type { OwnerRequest } from "../types";
import { editableRequest } from "./request-policy";

export function mutationNeedsReconcile(error: unknown) {
  return (
    error instanceof AppError &&
    (error.status === 409 ||
      error.kind === "network" ||
      error.kind === "protocol" ||
      (error.status >= 500 && error.status !== 503))
  );
}
export const requestDraftLabels: Record<keyof RequestDraft, string> = {
  title: "Tiêu đề",
  skillId: "Kỹ năng",
  description: "Mô tả nhu cầu",
  learningGoal: "Mục tiêu học tập",
  currentLevel: "Trình độ",
  verifiedTeacherOnly: "Người dạy đã xác minh",
  preferredSlots: "Thời gian ưu tiên",
  weeklyAvailability: "Lịch rảnh theo tuần",
  expiresAt: "Hạn yêu cầu",
  timeZone: "Múi giờ lịch tuần",
  teachingOverview: "Nội dung có thể dạy",
  desiredCreditPerHour: "Credit mong muốn mỗi giờ",
  tagIds: "Tag",
  proposedTags: "Tag đề xuất",
  tagSearch: "Tag đang nhập",
  offeredSharingSkillIds: "Kỹ năng có thể dạy",
};
export function compareRequestDraft(
  initial: OwnerRequest,
  latest: OwnerRequest,
) {
  const before = requestDefaults(initial),
    after = requestDefaults(latest);
  return (Object.keys(requestDraftLabels) as (keyof RequestDraft)[])
    .filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    )
    .map((field) => ({
      field,
      label: requestDraftLabels[field],
      before: String(before[field]),
      after: String(after[field]),
    }));
}
export function rebaseRequestDraft(
  initial: OwnerRequest,
  draft: RequestDraft,
  latest: OwnerRequest,
): RequestDraft {
  if (initial.id !== latest.id) throw new AppError("protocol");
  if (!editableRequest(latest)) throw new AppError("http", 409);
  const old = requestDefaults(initial),
    next = requestDefaults(latest);
  for (const field of Object.keys(next) as (keyof RequestDraft)[]) {
    if (JSON.stringify(draft[field]) !== JSON.stringify(old[field]))
      Object.assign(next, { [field]: draft[field] });
  }
  if (latest.publishedAt) next.skillId = latest.skillId;
  return next;
}
