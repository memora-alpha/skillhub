import { useConnectionQuery } from "@/features/connections";
import { AppError } from "@/lib/http/errors";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { canValidateForFinalize } from "../utils/policy-api";
import { useLearningPathsApi } from "./use-learning-paths-api";

/** This existing POST only checks readiness; it never holds funds or creates sessions. */
export function useFinalValidation(path: ApiLearningPath, blocked: boolean) {
  const api = useLearningPathsApi();
  const ready = canValidateForFinalize(path);
  const snapshot = JSON.stringify(path);
  const query = useConnectionQuery(
    ["learning-paths", path.id, "final-validation", snapshot],
    async () => {
      const result = await api.validate(path.id);
      if (
        result.version !== path.currentVersion ||
        result.exchangeType !== path.agreement.exchangeType ||
        result.planCount !== path.plans.length ||
        result.scheduleCount !== path.plans.length
      )
        throw new AppError("protocol");
      return result;
    },
    ready && !blocked,
  );
  return {
    ...query,
    ready,
    canFinalize:
      ready && !blocked && !!query.data && !query.error && !query.isFetching,
  };
}
