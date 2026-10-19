import { useSyncExternalStore } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useSkills } from "../context/SkillsProvider";

export function usePrivateSkillQuery<
  T extends { data: unknown; error: unknown },
>(key: QueryKey, query: T) {
  const { privateReads, isCurrent } = useSkills();
  useSyncExternalStore(
    privateReads.subscribe,
    privateReads.snapshot,
    privateReads.snapshot,
  );
  const readDenied = privateReads.denied(key);
  return {
    ...query,
    data: readDenied || !isCurrent() ? undefined : query.data,
    error: readDenied ?? query.error,
    readDenied,
    canRead: () => isCurrent() && !privateReads.denied(key),
  };
}
