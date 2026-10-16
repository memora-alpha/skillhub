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
import type { OwnSkill, Verification } from "../types/skills";
import { recordVerificationQueries } from "../utils/record-verification-queries";
import { recordSkillQueries } from "../utils/record-skill-queries";
import { observeVerificationDecisions } from "../utils/verification-state";
import { recordCreatedSkillReads } from "../utils/own-skill-order";
import { createMutationIntent } from "../utils/mutation-intent";
import { createEvidenceTransfers } from "../utils/evidence-transfers";
import { compressEvidence } from "../api/evidence-compression";
import { randomUUID } from "expo-crypto";
import { useToast } from "@/providers/ToastProvider";
import { AppState } from "react-native";

function useSkillsRuntime() {
  const { runtime, session } = useAuthSession();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const generation = runtime.controller.generation;
  const userId = session?.userId ?? "";
  return useMemo(() => {
    const scope = ["skills", generation, userId] as const;
    const deletedSkillIds = new Set<string>();
    const verificationDrafts = new Map<string, VerificationDraft>();
    const verificationIntents = new Map<
      string,
      ReturnType<typeof createMutationIntent>
    >();
    const submittedVerifications = new Map<string, Verification>();
    const recentlyCreatedSkills = new Map<string, OwnSkill>();
    const isCurrent = () =>
      runtime.controller.generation === generation &&
      runtime.controller.getSnapshot() === "ready";
    const core = {
      api: createSkillsApi(runtime.client),
      scope,
      generation,
      userId,
      isCurrent,
      deletedSkillIds,
      verificationDrafts,
      verificationIntents,
      submittedVerifications,
      recentlyCreatedSkills,
      observeCreatedSkills(skills: OwnSkill[], complete = false) {
        if (!isCurrent()) return;
        transfers.observeSkills(skills);
        recordCreatedSkillReads(recentlyCreatedSkills, skills, complete);
      },
      async rememberSkill(skill: OwnSkill, created = false) {
        if (!isCurrent() || deletedSkillIds.has(skill.id)) return;
        await queryClient.cancelQueries({ queryKey: scope });
        if (isCurrent() && !deletedSkillIds.has(skill.id)) {
          if (created || recentlyCreatedSkills.has(skill.id))
            recentlyCreatedSkills.set(skill.id, skill);
          recordSkillQueries(queryClient, scope, skill);
        }
      },
      observeVerifications(batches: Verification[]) {
        if (isCurrent()) transfers.observe(batches);
        if (
          !isCurrent() ||
          !observeVerificationDecisions(batches, submittedVerifications)
        )
          return;
        // History decisions do not contain the aggregate skill badge/version.
        // Refresh those authoritative projections instead of computing them.
        void Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: [...scope, "own"] }),
          queryClient.invalidateQueries({ queryKey: [...scope, "detail"] }),
          queryClient.invalidateQueries({ queryKey: [...scope, "public"] }),
          queryClient.invalidateQueries({
            queryKey: ["account", "me", generation],
          }),
        ]);
      },
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
        transfers.forget(id);
        verificationDrafts.delete(id);
        verificationIntents.delete(id);
        submittedVerifications.delete(id);
        recentlyCreatedSkills.delete(id);
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
    const transfers: ReturnType<typeof createEvidenceTransfers> =
      createEvidenceTransfers({
        api: core.api,
        drafts: verificationDrafts,
        intents: verificationIntents,
        isCurrent,
        compress: compressEvidence,
        remember: core.rememberVerification,
        refresh: core.refresh,
        key: randomUUID,
        notify: showToast,
      });
    return { ...core, transfers };
  }, [runtime, generation, userId, queryClient, showToast]);
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
  useEffect(() => {
    value.transfers.activate();
    if (
      AppState.currentState === "background" ||
      AppState.currentState === "inactive"
    )
      value.transfers.pause();
    else value.transfers.resume();
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") value.transfers.pause();
      else value.transfers.resume();
    });
    return () => {
      listener.remove();
      value.transfers.dispose();
      value.verificationDrafts.clear();
      value.verificationIntents.clear();
      value.submittedVerifications.clear();
      value.deletedSkillIds.clear();
      value.recentlyCreatedSkills.clear();
      void queryClient.cancelQueries({ queryKey: value.scope });
      queryClient.removeQueries({ queryKey: value.scope });
    };
  }, [queryClient, value]);
  return (
    <SkillsContext.Provider value={value}>{children}</SkillsContext.Provider>
  );
}
export function useSkills() {
  const value = useContext(SkillsContext);
  if (!value) throw new Error("SkillsProvider is required");
  return value;
}
