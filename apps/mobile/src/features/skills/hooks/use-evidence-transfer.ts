import { useSyncExternalStore } from "react";
import { useSkills } from "../context/SkillsProvider";

export function useEvidenceTransfer(id?: string) {
  const { transfers } = useSkills();
  return useSyncExternalStore(
    transfers.subscribe,
    () => (id ? transfers.get(id) : null),
    () => null,
  );
}
