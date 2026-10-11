import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/features/auth";
import { AppError } from "@/lib/http/errors";
import { createSkillsApi } from "../api/skills-api";
import type { VerificationDraft } from "../utils/evidence-draft";
import { removeSkillQueries } from "../utils/remove-skill-queries";
import type { Verification } from "../types/skills";
import { recordVerificationQueries } from "../utils/record-verification-queries";

function useSkillsRuntime() {
  const { runtime, session } = useAuthSession();
  const queryClient = useQueryClient();
  const generation = runtime.controller.generation;
  const userId = session?.userId ?? "";
  return useMemo(() => {
    const scope = ["skills", generation, userId] as const;
    const deletedSkillIds = new Set<string>();
    const verificationDrafts = new Map<string, VerificationDraft>();
    const submittedVerifications = new Map<string, Verification>();
    const isCurrent = () =>
      runtime.controller.generation === generation &&
      runtime.controller.getSnapshot() === "ready";
    return {
      api: createSkillsApi(runtime.client),
      scope,
      generation,
      userId,
      isCurrent,
      deletedSkillIds,
      verificationDrafts,
      submittedVerifications,
      async rememberVerification(batch: Verification) {
        if (!isCurrent()) return;
        submittedVerifications.set(batch.sharingSkillId, batch);
        await queryClient.cancelQueries({ queryKey: scope });
        if (isCurrent())
          recordVerificationQueries(
            queryClient,
            scope,
            batch,
            submittedVerifications,
          );
      },
      async forgetSkill(id: string) {
        if (!isCurrent()) return;
        deletedSkillIds.add(id);
        verificationDrafts.delete(id);
        submittedVerifications.delete(id);
        await queryClient.cancelQueries({ queryKey: scope });
        if (isCurrent()) removeSkillQueries(queryClient, scope, id);
      },
      assertCurrent() {
        if (!isCurrent()) throw new AppError("session");
      },
      async refresh() {
        if (!isCurrent()) return false;
        const results = await Promise.allSettled([
          queryClient.invalidateQueries(
            { queryKey: scope },
            { throwOnError: true },
          ),
          queryClient.invalidateQueries(
            { queryKey: ["account", "me", generation] },
            { throwOnError: true },
          ),
        ]);
        return (
          isCurrent() &&
          results.every((result) => result.status === "fulfilled")
        );
      },
    };
  }, [runtime, generation, userId, queryClient]);
}
type SkillsRuntime = ReturnType<typeof useSkillsRuntime>;
const SkillsContext = createContext<SkillsRuntime | null>(null);
export function SkillsProvider({ children }: { children: ReactNode }) {
  const { runtime, session } = useAuthSession();
  return (
    <SkillsSession key={`${runtime.controller.generation}:${session?.userId}`}>
      {children}
    </SkillsSession>
  );
}
function SkillsSession({ children }: { children: ReactNode }) {
  const value = useSkillsRuntime();
  const queryClient = useQueryClient();
  useEffect(
    () => () => {
      value.verificationDrafts.clear();
      value.submittedVerifications.clear();
      value.deletedSkillIds.clear();
      void queryClient.cancelQueries({ queryKey: value.scope });
      queryClient.removeQueries({ queryKey: value.scope });
    },
    [queryClient, value],
  );
  return (
    <SkillsContext.Provider value={value}>{children}</SkillsContext.Provider>
  );
}
export function useSkills() {
  const value = useContext(SkillsContext);
  if (!value) throw new Error("SkillsProvider is required");
  return value;
}
