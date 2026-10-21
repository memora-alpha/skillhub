import { z } from "zod";
import { uuid } from "@/lib/http/contracts";

const shared = z.object({
  pathId: uuid,
  planId: uuid,
  version: z.coerce.number().int().positive().safe(),
});
export function planShareMessage(
  pathId: string,
  planId: string,
  version: number,
  goal: string,
  sessions: number,
) {
  shared.parse({ pathId, planId, version });
  return `Mình gửi bạn lộ trình học: ${goal.trim().replace(/\s+/g, " ").slice(0, 160)}\n${sessions} buổi · Phiên bản ${version}\nskillhub://paths/${pathId}/plans/${planId}?version=${version}`;
}
export function readPlanShare(text: string) {
  const match =
    /^Mình gửi bạn lộ trình học: ([^\n]{1,160})\n\d+ buổi · Phiên bản (\d+)\nskillhub:\/\/paths\/([\da-f-]+)\/plans\/([\da-f-]+)\?version=(\d+)$/i.exec(
      text,
    );
  if (!match || match[2] !== match[5]) return null;
  const result = shared.safeParse({
    pathId: match[3],
    planId: match[4],
    version: match[5],
  });
  return result.success ? { ...result.data, title: match[1]! } : null;
}
