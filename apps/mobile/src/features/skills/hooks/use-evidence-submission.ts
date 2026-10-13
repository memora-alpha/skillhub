import { randomUUID } from "expo-crypto";
import { AppError } from "@/lib/http/errors";
import { useSkills } from "../context/SkillsProvider";
import { createMutationIntent } from "../utils/mutation-intent";
import { normalizeText } from "../schemas/skill-form";

export function useEvidenceSubmission() {
  const { api, rememberVerification, refresh, verificationIntents } =
    useSkills();
  return async (
    id: string,
    fileIds: string[],
    title: string,
    description: string,
  ) => {
    const body = {
      fileIds,
      title: normalizeText(title),
      description: normalizeText(description),
    };
    // Keep an unknown submit outcome retryable after returning to the list.
    let intent = verificationIntents.get(id);
    if (!intent) {
      intent = createMutationIntent(randomUUID);
      verificationIntents.set(id, intent);
    }
    try {
      const result = await api.submit(
        id,
        body,
        intent.key(`submit:${id}`, body),
      );
      await rememberVerification(result);
      verificationIntents.delete(id);
      return result;
    } catch (error) {
      if (error instanceof AppError && error.code === "VERIFICATION_PENDING")
        await refresh();
      throw error;
    }
  };
}
