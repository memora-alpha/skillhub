import { needsScan, type EvidenceDraft } from "./evidence-draft";
import { skillError } from "./skill-errors";

export function markEvidenceChecking(files: EvidenceDraft[]) {
  return files.map((file) =>
    file.fileId && (needsScan(file.state) || file.state === "READY")
      ? { ...file, checking: true, error: undefined }
      : file,
  );
}

export function reconcileEvidencePolling(
  files: EvidenceDraft[],
  waiting: EvidenceDraft[],
  results: PromiseSettledResult<{ state: string }>[],
  attempts: ReadonlyMap<string, number>,
) {
  return files.map((file) => {
    const index = waiting.findIndex((item) => item.localId === file.localId);
    const result = results[index];
    if (!result || index < 0) return file;
    if (result.status === "rejected")
      return { ...file, error: skillError(result.reason) };
    const timedOut =
      needsScan(result.value.state) && (attempts.get(file.fileId!) ?? 0) >= 10;
    return {
      ...file,
      state: result.value.state,
      checking: false,
      error: timedOut
        ? "Đang chờ kiểm tra lâu hơn dự kiến. Bạn có thể kiểm tra lại."
        : undefined,
    };
  });
}
