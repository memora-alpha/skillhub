import { z } from "zod";
import { uuid, version } from "@/lib/http/contracts";

export function confirmedMethodMessage(
  pathId: string,
  version: number,
  terms: {
    exchangeType: "ONE_WAY" | "TWO_WAY";
    totalCreditPerUser?: string | null;
    negotiatedCredit?: string | null;
  },
) {
  return confirmedFormMessage({
    kind: "method",
    pathId,
    version,
    title:
      terms.exchangeType === "TWO_WAY" ? "Trao đổi hai chiều" : "Học một chiều",
    summary:
      terms.exchangeType === "TWO_WAY"
        ? `${terms.totalCreditPerUser ?? "—"} Credit cam kết mỗi người`
        : `${terms.negotiatedCredit ?? "—"} Credit cho toàn bộ lộ trình`,
  });
}

const form = z
  .object({
    kind: z.enum(["method", "plan", "schedule"]),
    pathId: uuid,
    version,
    planId: uuid.optional(),
    scheduleId: uuid.optional(),
    title: z.string().min(1).max(160),
    summary: z.string().max(600),
  })
  .refine(hasValidReferences);

function hasValidReferences(value: {
  kind: "method" | "plan" | "schedule";
  planId?: string;
  scheduleId?: string;
}) {
  if (value.kind === "method") return !value.planId && !value.scheduleId;
  if (value.kind === "plan") return !!value.planId && !value.scheduleId;
  return !!value.planId && !!value.scheduleId;
}
export type ConfirmedForm = z.infer<typeof form>;
export const confirmedFormLabels = {
  method: "Cách học",
  plan: "Lộ trình học",
  schedule: "Lịch học",
} as const;
const line = (text: string, max: number) =>
  text.trim().replace(/\s+/g, " ").slice(0, max);

export function confirmedFormMessage(input: ConfirmedForm) {
  const value = form.parse({
    ...input,
    title: line(input.title, 160) || confirmedFormLabels[input.kind],
    summary: line(input.summary, 600),
  });
  const query = new URLSearchParams({ version: String(value.version) });
  if (value.planId) query.set("planId", value.planId);
  if (value.scheduleId) query.set("scheduleId", value.scheduleId);
  return `Mình đã xác nhận ${confirmedFormLabels[value.kind].toLowerCase()}: ${value.title}\n${value.summary}\nBản ${value.version}\nskillhub://confirmed/${value.kind}/${value.pathId}?${query}`;
}
export function readConfirmedForm(text: string): ConfirmedForm | null {
  const match =
    /^Mình đã xác nhận (cách học|lộ trình học|lịch học): ([^\n]{1,160})\n([^\n]{0,600})\nBản (\d+)\nskillhub:\/\/confirmed\/(method|plan|schedule)\/([\da-f-]+)\?([^\n]+)$/i.exec(
      text,
    );
  if (!match?.[7]) return null;
  // Chat history can return HTML-escaped query separators. Decode only the
  // workflow URL query, preserving the user's title and summary verbatim.
  const params = new URLSearchParams(match[7].replaceAll("&amp;", "&"));
  const result = form.safeParse({
    kind: match[5],
    pathId: match[6],
    version: Number(params.get("version")),
    planId: params.get("planId") ?? undefined,
    scheduleId: params.get("scheduleId") ?? undefined,
    title: match[2],
    summary: match[3],
  });
  if (
    !result.success ||
    String(result.data.version) !== match[4] ||
    match[1] !== confirmedFormLabels[result.data.kind].toLowerCase()
  )
    return null;
  return result.data;
}
