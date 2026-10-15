import {
  evidenceDraft,
  type EvidenceAsset,
  type EvidenceDraft,
} from "./evidence-draft";

export const IMAGE_COMPRESSION_THRESHOLD = 2_000_000;
export function shouldCompressEvidence(file: EvidenceDraft) {
  return (
    file.mime.startsWith("image/") &&
    file.size > IMAGE_COMPRESSION_THRESHOLD &&
    !file.fileId &&
    !file.keepOriginal &&
    !file.compressionChecked
  );
}

export function createEvidenceCompressor(
  encode: (asset: EvidenceAsset) => Promise<EvidenceAsset>,
) {
  return async (file: EvidenceDraft): Promise<EvidenceDraft> => {
    if (!shouldCompressEvidence(file)) return file;
    try {
      const asset = await encode(file.asset);
      const compressed = evidenceDraft(asset, file.localId);
      if (compressed.size < file.size)
        return {
          ...compressed,
          compressionChecked: true,
          originalAsset: file.asset,
          originalSize: file.size,
        };
    } catch {
      // Optimization is optional; a valid original remains uploadable.
    }
    return { ...file, compressionChecked: true };
  };
}

export function keepOriginalEvidence(
  file: EvidenceDraft,
  keepOriginal: boolean,
) {
  if (file.fileId) return file;
  const original = evidenceDraft(
    file.originalAsset ?? file.asset,
    file.localId,
  );
  return { ...original, keepOriginal };
}
