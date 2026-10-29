import { z } from "zod";
import { timestamp, uuid, version } from "@/lib/http/contracts";

const noticeSchema = z
  .object({
    pathId: uuid,
    version,
    sessionCount: z.number().int().min(1).max(200),
    startAt: timestamp,
    endAt: timestamp,
  })
  .refine((value) => Date.parse(value.startAt) < Date.parse(value.endAt));
export type ScheduledNotice = z.infer<typeof noticeSchema>;

export function scheduledMessage(result: {
  pathId: string;
  version: number;
  sessions: readonly { startAt: string; endAt: string }[];
}) {
  const value = noticeSchema.parse({
    pathId: result.pathId,
    version: result.version,
    sessionCount: result.sessions.length,
    startAt: new Date(
      Math.min(
        ...result.sessions.map((session) => Date.parse(session.startAt)),
      ),
    ).toISOString(),
    endAt: new Date(
      Math.max(...result.sessions.map((session) => Date.parse(session.endAt))),
    ).toISOString(),
  });
  const query = new URLSearchParams({
    version: String(value.version),
    sessions: String(value.sessionCount),
    startAt: value.startAt,
    endAt: value.endAt,
  });
  return `Lịch học đã chốt\n${value.sessionCount} buổi học\nskillhub://scheduled/${value.pathId}?${query}`;
}

export function readScheduledMessage(text: string): ScheduledNotice | null {
  const match =
    /^Lịch học đã chốt\n(\d+) buổi học\nskillhub:\/\/scheduled\/([\da-f-]+)\?([^\n]+)$/i.exec(
      text,
    );
  if (!match) return null;
  const query = new URLSearchParams(match[3]!.replaceAll("&amp;", "&"));
  const parsed = noticeSchema.safeParse({
    pathId: match[2],
    version: Number(query.get("version")),
    sessionCount: Number(query.get("sessions")),
    startAt: query.get("startAt"),
    endAt: query.get("endAt"),
  });
  return parsed.success && String(parsed.data.sessionCount) === match[1]
    ? parsed.data
    : null;
}
