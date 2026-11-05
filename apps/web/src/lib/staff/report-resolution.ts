export const violationLabels = {
  LATE_CANCELLATION: "Hủy muộn",
  NO_SHOW: "Không tham gia buổi học",
  LIGHT_VIOLATION: "Vi phạm nhẹ",
  MEDIUM_HARASSMENT: "Quấy rối mức trung bình",
  FRAUD: "Gian lận",
} as const;
export type ViolationCode = keyof typeof violationLabels;
export type ParticipantOutcome = {
  userId: string;
  violation: ViolationCode | "";
  delta: string;
  amount: string;
};
export type ResolutionDraft = {
  noShowRuling?: "" | "UPHOLD" | "EXCUSE" | "COMPLETE";
  cancellationMakeupRuling?: "" | "EXTEND" | "COMPLETE";
  makeupUserId?: string;
  participants: ParticipantOutcome[];
  restrictedUserId: string;
  days: string;
  reversals: string;
};
type ViolationOutcome = {
  userId: string;
  reasonCode: ViolationCode | "";
  delta?: number;
};

function sessionRulingBody(
  draft: ResolutionDraft,
  violations: ViolationOutcome[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (draft.cancellationMakeupRuling) {
    if (
      draft.noShowRuling ||
      !["EXTEND", "COMPLETE"].includes(draft.cancellationMakeupRuling)
    )
      throw new Error("Chỉ chọn một loại phán quyết buổi học.");
    body.cancellationMakeupRuling = draft.cancellationMakeupRuling;
  }
  if (draft.makeupUserId) {
    if (
      draft.noShowRuling !== "EXCUSE" ||
      !draft.participants.some((p) => p.userId === draft.makeupUserId)
    )
      throw new Error(
        "Chọn người tham gia yêu cầu học bù khi xử lý điểm danh chưa xác minh.",
      );
    body.makeupUserId = draft.makeupUserId;
  }
  if (draft.noShowRuling) {
    if (!["UPHOLD", "EXCUSE", "COMPLETE"].includes(draft.noShowRuling))
      throw new Error("Chọn phán quyết điểm danh hợp lệ.");
    if (violations.some((v) => v.reasonCode === "NO_SHOW"))
      throw new Error(
        "Dùng phán quyết điểm danh để xử lý vắng học; không ghi thêm vi phạm NO_SHOW.",
      );
    body.noShowRuling = draft.noShowRuling;
  }
  return body;
}

export function reportResolutionBody(
  draft: ResolutionDraft,
  admin: boolean,
): Record<string, unknown> {
  const violations = draft.participants
    .filter((p) => p.violation)
    .map((p) => {
      if (p.violation === "FRAUD") {
        const delta = Number(p.delta);
        if (
          !p.delta.trim() ||
          !Number.isInteger(delta) ||
          delta < -30 ||
          delta > -20
        )
          throw new Error(
            "Mức trừ điểm gian lận phải là số nguyên từ -30 đến -20.",
          );
        return { userId: p.userId, reasonCode: p.violation, delta };
      }
      return { userId: p.userId, reasonCode: p.violation };
    });
  const body = sessionRulingBody(draft, violations);
  if (violations.length) body.violations = violations;
  if (!admin) return body;
  const adjustments = draft.participants
    .filter((p) => p.amount.trim())
    .map((p) => {
      const amount = p.amount.trim();
      if (
        !/^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amount) ||
        Number(amount) === 0
      )
        throw new Error(
          "Credit điều chỉnh phải khác 0 và có tối đa 2 chữ số thập phân.",
        );
      return { userId: p.userId, amount };
    });
  if (adjustments.length) body.creditAdjustments = adjustments;
  if (draft.restrictedUserId) {
    const days = Number(draft.days);
    if (
      ![1, 3, 7, 30].includes(days) ||
      !draft.participants.some((p) => p.userId === draft.restrictedUserId)
    )
      throw new Error("Chọn người tham gia và thời hạn hạn chế hợp lệ.");
    body.restriction = { userId: draft.restrictedUserId, days };
  }
  const ids = draft.reversals.split(/\s+/u).filter(Boolean);
  if (
    ids.length > 5 ||
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ),
    )
  )
    throw new Error("Nhập tối đa 5 mã giao dịch UUID v4 khác nhau.");
  if (ids.length) body.reversals = ids.map((operationId) => ({ operationId }));
  return body;
}
