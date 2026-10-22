import { useMemo } from "react";
import { useConnections, useConnectionList } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { createSkillSharersApi } from "../api/skill-sharers-api";

export function useSkillSharers(skillId: string, verifiedOnly: boolean) {
  const runtime = useConnections();
  const api = useMemo(() => createSkillSharersApi(runtime.call), [runtime]);
  return useConnectionList(
    ["skill-sharers", skillId, verifiedOnly],
    (cursor, signal) => api.list(skillId, verifiedOnly, cursor, signal),
    uuid.safeParse(skillId).success,
  );
}
