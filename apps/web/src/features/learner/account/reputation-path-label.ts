export function validReputationPathId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Learning goals identify the real plans; never use a cached different path's label. */
export function reputationPathGoals(value: unknown, pathId: string): string[] {
  if (!value || typeof value !== "object") return [];
  const path = value as { id?: unknown; plans?: unknown };
  if (
    typeof path.id !== "string" ||
    path.id.toLowerCase() !== pathId.toLowerCase() ||
    !Array.isArray(path.plans)
  )
    return [];
  return [
    ...new Set(
      path.plans.flatMap((plan) => {
        if (
          !plan ||
          typeof plan !== "object" ||
          typeof plan.learningGoal !== "string"
        )
          return [];
        const goal = plan.learningGoal.trim();
        return goal ? [goal] : [];
      }),
    ),
  ];
}
