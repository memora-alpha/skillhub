import { z } from "zod";
import { uuid, version } from "@/lib/http/contracts";
import { readConfirmedForm } from "./confirmed-form";

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
