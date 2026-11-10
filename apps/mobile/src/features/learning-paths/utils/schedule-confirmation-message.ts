import { z } from "zod";
import { uuid, version } from "@/lib/http/contracts";
import { confirmedFormMessage, readConfirmedForm } from "./confirmed-form";

const confirmation = z
  .object({
    pathId: uuid,
    planId: uuid,
    scheduleId: uuid,
    version,
    confirmedBy: uuid,
    teacherId: uuid,
    learnerId: uuid,
    bothConfirmed: z.boolean(),
    title: z.string().min(1).max(160),
  })
  .refine(
    (value) =>
      value.teacherId !== value.learnerId &&
      [value.teacherId, value.learnerId].includes(value.confirmedBy),
  );
export type ScheduleConfirmation = z.infer<typeof confirmation>;

// A normal participant TEXT message, not a server SYSTEM event. Keep the
// existing confirmation link readable by older clients and include the receipt
// status in structured query fields for current clients.
export function scheduleConfirmationMessage(input: ScheduleConfirmation) {
  const value = confirmation.parse({
    ...input,
    title: input.title.trim().replace(/\s+/g, " ").slice(0, 160) || "Lịch học",
  });
  const teacher = value.confirmedBy === value.teacherId;
  const summary = value.bothConfirmed
    ? "Hai bên đã đồng ý lịch này · Chưa chốt lịch."
    : `${teacher ? "Người dạy" : "Người học"} đã đồng ý · Chờ ${teacher ? "người học" : "người dạy"} xác nhận.`;
  const message = confirmedFormMessage({
    kind: "schedule",
    pathId: value.pathId,
    planId: value.planId,
    scheduleId: value.scheduleId,
    version: value.version,
    title: value.title,
    summary,
  });
  const metadata = new URLSearchParams({
    scheduleConfirmation: "1",
    confirmedBy: value.confirmedBy,
    teacherId: value.teacherId,
    learnerId: value.learnerId,
    bothConfirmed: String(value.bothConfirmed),
  });
  return `${message}&${metadata}`;
}

export function readScheduleConfirmation(
  text: string,
): ScheduleConfirmation | null {
  const form = readConfirmedForm(text);
  if (form?.kind !== "schedule") return null;
  const params = new URLSearchParams(
    text.slice(text.lastIndexOf("?") + 1).replaceAll("&amp;", "&"),
  );
  const both = params.get("bothConfirmed");
  if (
    params.get("scheduleConfirmation") !== "1" ||
    !["true", "false"].includes(both ?? "")
  )
    return null;
  const parsed = confirmation.safeParse({
    pathId: form.pathId,
    planId: form.planId,
    scheduleId: form.scheduleId,
    version: form.version,
    title: form.title,
    confirmedBy: params.get("confirmedBy"),
    teacherId: params.get("teacherId"),
    learnerId: params.get("learnerId"),
    bothConfirmed: both === "true",
  });
  return parsed.success ? parsed.data : null;
}
