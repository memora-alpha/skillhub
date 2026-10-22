import { useLearningPath } from "@/features/learning-paths";
import type { LearningSession } from "../types";
import { resolveSessionContext } from "../utils/session-context";

export function useSessionContext(session: LearningSession | undefined) {
  const query = useLearningPath(session?.pathId ?? "");
  return {
    ...query,
    context:
      session && query.data
        ? resolveSessionContext(session, query.data)
        : undefined,
  };
}
