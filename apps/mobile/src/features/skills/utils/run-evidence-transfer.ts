import type { createSkillsApi } from "../api/skills-api";
import type { Verification } from "../types/skills";
import type { EvidenceDraft, VerificationDraft } from "./evidence-draft";
import { createMutationIntent } from "./mutation-intent";
import { normalizeText } from "../schemas/skill-form";
import { prepareEvidence } from "./prepare-evidence";

export type EvidenceTransferDependencies = {
  api: Pick<
    ReturnType<typeof createSkillsApi>,
    "upload" | "fileStatus" | "submit"
  >;
  drafts: Map<string, VerificationDraft>;
  intents: Map<string, ReturnType<typeof createMutationIntent>>;
  isCurrent: () => boolean;
  compress: (file: EvidenceDraft) => Promise<EvidenceDraft>;
  remember: (batch: Verification) => Promise<void>;
  refresh: () => Promise<unknown>;
  key: () => string;
  notify: (message: string, tone: "success" | "error" | "info") => void;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};

export async function runEvidenceTransfer(
  dependencies: EvidenceTransferDependencies,
  id: string,
  draft: VerificationDraft,
  signal: AbortSignal,
  check: () => void,
  update: (file: EvidenceDraft) => void,
  onSlowScan?: () => void,
) {
  const { api, compress, intents, remember, key } = dependencies;
  const fileIds = await prepareEvidence({
    api: {
      ...api,
      upload: (skillId, body) => api.upload(skillId, body, signal),
    },
    id,
    files: draft.files,
    signal,
    assertCurrent: check,
    update,
    prepare: compress,
    onSlowScan,
    sleep: dependencies.sleep,
  });
  check();
  const body = {
    fileIds,
    title: normalizeText(draft.title),
    description: normalizeText(draft.description),
  };
  let intent = intents.get(id);
  if (!intent) {
    intent = createMutationIntent(key);
    intents.set(id, intent);
  }
  const batch = await api.submit(id, body, intent.key(`submit:${id}`, body));
  check();
  await remember(batch);
  check();
  return batch;
}
