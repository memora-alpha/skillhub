import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "@/features/auth";
import { createPublicProfileApi } from "@/features/profile";
import { useSessionsRuntime } from "../runtime";
import type { LearningSession } from "../types";

export function useSessionPartner(session: LearningSession | undefined) {
  const runtime = useSessionsRuntime(),
    auth = useAuthSession();
  const partnerId =
    session &&
    (session.teacherId === runtime.userId
      ? session.learnerId
      : session.teacherId);
  const api = useMemo(
    () => createPublicProfileApi(auth.runtime.client, runtime.isCurrent),
    [auth.runtime.client, runtime.isCurrent],
  );
  return useQuery({
    queryKey: [...runtime.key, "partner", partnerId],
    enabled: runtime.enabled && !!partnerId,
    retry: false,
    queryFn: ({ signal }) => api.get(partnerId!, signal),
  });
}
