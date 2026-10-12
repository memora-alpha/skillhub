import { z } from "zod";
import { parseLocalDateTime } from "@/utils/local-date-time";
import { formatPreferredSlots, parsePreferredSlots } from "../preferred-slots";
import { validWeeklyRows } from "../utils/request-weekly-slots";
import { requestLevels, type OwnerRequest, type RequestInput } from "../types";
const text = (min: number, max: number) =>
  z
    .string()
    .transform((value) => value.normalize("NFKC").trim())
    .refine(
      (value) => [...value].length >= min && [...value].length <= max,
      `Nhập từ ${min} đến ${max} ký tự.`,
    );
export function localTimestamp(value: string | null) {
  if (!value) return "";
  return formatPreferredSlots([{ startAt: value, endAt: value }]).split(
    " → ",
  )[0]!;
}
export function requestFormSchema(
  initial?: OwnerRequest,
  clock: number | (() => number) = () => Date.now(),
) {
  const now = () => (typeof clock === "number" ? clock : clock());
  return z.object({
    title: text(10, 120),
    skillId: z.uuid("Chọn một kỹ năng trong danh mục."),
    description: text(20, 3000),
    learningGoal: text(10, 1000),
    currentLevel: z.union([z.enum(requestLevels), z.literal("")]),
    verifiedTeacherOnly: z.enum(["Không", "Có"]),
    preferredSlots: z
      .string()
      .refine(
        (value) =>
          (initial && value === formatPreferredSlots(initial.preferredSlots)) ||
          parsePreferredSlots(value, now()) !== undefined,
        "Khoảng đã lưu không còn hợp lệ.",
      ),
    weeklyAvailability: z
      .string()
      .refine(
        validWeeklyRows,
        "Chọn thứ và hai giờ hợp lệ, không chồng nhau. Tối đa 5 khoảng.",
      ),
    expiresAt: z.string().refine((value) => {
      if (
        !value ||
        (initial && value === localTimestamp(initial.requestedExpiresAt))
      )
        return true;
      const date = parseLocalDateTime(value.replace(" ", "T"));
      return !!date && date.getTime() > now();
    }, "Chọn ngày và giờ trong tương lai cho hạn yêu cầu."),
  });
}
export type RequestDraft = z.infer<ReturnType<typeof requestFormSchema>>;
export function requestDefaults(initial?: OwnerRequest): RequestDraft {
  return {
    title: initial?.title ?? "",
    skillId: initial?.skillId ?? "",
    description: initial?.description ?? "",
    learningGoal: initial?.learningGoal ?? "",
    currentLevel: initial?.currentLevel ?? "",
    verifiedTeacherOnly: initial?.verifiedTeacherOnly ? "Có" : "Không",
    preferredSlots: formatPreferredSlots(initial?.preferredSlots),
    weeklyAvailability: "",
    expiresAt: localTimestamp(initial?.requestedExpiresAt ?? null),
  };
}
export function draftToInput(
  draft: RequestDraft,
  initial?: OwnerRequest,
  now = Date.now(),
): RequestInput {
  const parsed = requestFormSchema(initial, now).parse(draft);
  if (parsed.weeklyAvailability.trim())
    throw new z.ZodError([
      {
        code: "custom",
        path: ["weeklyAvailability"],
        message: "Lịch theo tuần chưa hỗ trợ lưu.",
      },
    ]);
  const slots =
    initial &&
    parsed.preferredSlots === formatPreferredSlots(initial.preferredSlots)
      ? initial.preferredSlots
      : parsePreferredSlots(parsed.preferredSlots, now);
  if (!slots)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["preferredSlots"],
        message: "Thời gian ưu tiên không còn hợp lệ.",
      },
    ]);
  let expiresAt: string | null = null;
  if (
    initial &&
    parsed.expiresAt === localTimestamp(initial.requestedExpiresAt)
  )
    expiresAt = initial.requestedExpiresAt;
  else if (parsed.expiresAt) {
    const date = parseLocalDateTime(parsed.expiresAt.replace(" ", "T"));
    if (!date)
      throw new z.ZodError([
        {
          code: "custom",
          path: ["expiresAt"],
          message: "Hạn yêu cầu không hợp lệ.",
        },
      ]);
    expiresAt = date.toISOString();
  }
  return {
    title: parsed.title,
    skillId: parsed.skillId,
    description: parsed.description,
    learningGoal: parsed.learningGoal,
    currentLevel: parsed.currentLevel || null,
    verifiedTeacherOnly: parsed.verifiedTeacherOnly === "Có",
    preferredSlots: slots,
    expiresAt,
  };
}
