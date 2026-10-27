import type { ApiLearningPath, PathSummary } from "@/features/learning-paths";
import type { LearningSession } from "@/features/sessions";

const hour = 60 * 60 * 1000;
const upcomingStatuses = new Set(["CONFIRMED", "READY", "ONGOING"]);

export function homeReadValue<T>(value: T, active: boolean, error: unknown) {
  if (!active || error) return;
  return value;
}

export function homeSessionRange(now: number) {
  return {
    from: new Date(now - 3 * hour).toISOString(),
    to: new Date(now + 30 * 24 * hour).toISOString(),
  };
}

export function selectUpcomingSession(
  items: readonly LearningSession[],
  now: number,
) {
  return items
    .filter(
      (session) =>
        upcomingStatuses.has(session.status) && Date.parse(session.endAt) > now,
    )
    .sort(
      (a, b) =>
        Date.parse(a.startAt) - Date.parse(b.startAt) ||
        a.id.localeCompare(b.id),
    )[0];
}

export function selectHomePathId(
  nextSession: LearningSession | undefined,
  paths: readonly PathSummary[],
) {
  return (
    nextSession?.pathId ??
    paths.find((path) => ["ACTIVE", "SCHEDULED"].includes(path.status))?.id
  );
}

export function homePathProgress(
  path: ApiLearningPath | undefined,
  userId: string,
) {
  const plan =
    path?.plans.find((item) => item.learnerId === userId) ?? path?.plans[0];
  // Path detail contains every session for each plan, unlike the bounded Home list.
  const sessions = path?.plans.flatMap((item) => item.sessions) ?? [];
  return {
    title: plan?.learningGoal.trim() || "Lộ trình học của bạn",
    completed: sessions.filter((item) => item.status === "COMPLETED").length,
    total: sessions.length,
  };
}
