export const EVIDENCE_MAX_BYTES = 10_000_000;
export const evidenceFormats: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export type EvidenceAsset = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  file?: File;
};
export type EvidenceDraft = {
  localId: string;
  asset: EvidenceAsset;
  mime: string;
  size: number;
  state: string;
  fileId?: string;
  error?: string;
  checking?: boolean;
};
export type VerificationDraft = {
  files: EvidenceDraft[];
  title: string;
  description: string;
};
export function evidenceDraft(
  asset: EvidenceAsset,
  localId: string,
): EvidenceDraft {
  const segments = asset.name.toLowerCase().split(".");
  const extension = segments.at(-1) ?? "";
  const mime = Object.hasOwn(evidenceFormats, extension)
    ? evidenceFormats[extension]
    : undefined;
  const claimed = (asset.file?.type || asset.mimeType)?.trim().toLowerCase();
  if (
    !asset.uri ||
    !mime ||
    !segments[0] ||
    segments
      .slice(0, -1)
      .some((part) =>
        /^(exe|com|dll|bat|cmd|ps1|js|mjs|html|htm|svg|php|sh|jar|msi)$/.test(
          part,
        ),
      ) ||
    /[\\/]/.test(asset.name) ||
    asset.name.length > 255 ||
    [...asset.name].some(
      (char) => char.charCodeAt(0) <= 31 || char.charCodeAt(0) === 127,
    )
  )
    throw new Error(
      "Chọn file PDF, DOC, DOCX, JPG, JPEG, PNG hoặc WEBP hợp lệ.",
    );
  if (claimed && claimed !== "application/octet-stream" && claimed !== mime)
    throw new Error("Tên file và định dạng không khớp. Hãy chọn file khác.");
  const size = asset.file?.size ?? asset.size;
  if (size === undefined || !Number.isSafeInteger(size) || size <= 0)
    throw new Error(
      "Không đọc được kích thước hoặc file rỗng. Chọn file khác.",
    );
  if (size > EVIDENCE_MAX_BYTES)
    throw new Error("File vượt quá 10 MB. Hãy chọn file nhỏ hơn.");
  return { localId, asset, mime, size, state: "SELECTED" };
}
export function evidenceFormData(draft: EvidenceDraft) {
  const body = new FormData();
  if (draft.asset.file)
    body.append(
      "file",
      draft.asset.file.slice(0, draft.asset.file.size, draft.mime),
      draft.asset.name,
    );
  else
    body.append("file", {
      uri: draft.asset.uri,
      type: draft.mime,
      name: draft.asset.name,
    } as unknown as Blob);
  return body;
}
export function readyFileIds(files: EvidenceDraft[]): string[] | null {
  if (
    !files.length ||
    files.length > 5 ||
    files.some(
      (file) => file.state !== "READY" || !file.fileId || file.checking,
    )
  )
    return null;
  const ids = files.map((file) => file.fileId!);
  return new Set(ids).size === ids.length ? ids.sort() : null;
}
export const needsScan = (state: string) =>
  state === "QUARANTINED" || state === "SCANNING";
export const fileStateLabels: Record<string, string> = {
  SELECTED: "Đã chọn · chờ gửi",
  UPLOADING: "Đang tải lên",
  QUARANTINED: "Đang chờ kiểm tra",
  SCANNING: "Đang kiểm tra",
  READY: "Sẵn sàng gửi",
  REJECTED: "File bị từ chối",
  SCAN_FAILED: "Kiểm tra thất bại",
  UPLOAD_FAILED: "Tải lên thất bại",
  DELETED: "File đã xóa",
  CLEANUP_PENDING: "File không khả dụng",
};
