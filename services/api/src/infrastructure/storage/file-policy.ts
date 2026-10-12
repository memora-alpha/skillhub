import {
  FileStorageError,
  type FilePurpose,
  type ValidatedFileFormat,
} from "./file.types";

export const CHAT_MAX_BYTES = 15_000_000;
export const APPROVED_EVIDENCE_MAX_BYTES = 10_000_000;
export const MATERIAL_MAX_BYTES = 20_000_000;

const formats = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
} as const;

const evidenceExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);
const unsafeEarlierExtensions = new Set([
  "exe",
  "com",
  "dll",
  "bat",
  "cmd",
  "ps1",
  "js",
  "mjs",
  "html",
  "htm",
  "svg",
  "php",
  "sh",
  "jar",
  "msi",
]);

export function validateFile(input: {
  purpose: FilePurpose;
  name: string;
  claimedMime: string;
  detectedMime: string;
  sizeBytes: number;
  capBytes?: number;
}): ValidatedFileFormat {
  const { purpose, name, claimedMime, detectedMime, sizeBytes } = input;
  if (
    purpose !== "EVIDENCE" &&
    purpose !== "REPORT" &&
    purpose !== "CHAT" &&
    purpose !== "MATERIAL"
  ) {
    throw new FileStorageError("FILE_POLICY_UNAVAILABLE", 503);
  }
  const cap = purpose === "CHAT" ? CHAT_MAX_BYTES : input.capBytes;
  if (cap === undefined || !Number.isSafeInteger(cap) || cap <= 0) {
    throw new FileStorageError("FILE_POLICY_UNAVAILABLE", 503);
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new FileStorageError("FILE_EMPTY_OR_INVALID", 400);
  }
  if (sizeBytes > cap) {
    throw new FileStorageError("FILE_TOO_LARGE", 413);
  }
  if (
    name.length === 0 ||
    name.length > 255 ||
    /[\\/]/u.test(name) ||
    [...name].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || code === 127;
    }) ||
    name === "." ||
    name === ".."
  ) {
    throw new FileStorageError("FILE_NAME_INVALID", 400);
  }
  const segments = name.split(".");
  const extension = segments.at(-1)?.toLowerCase();
  if (
    !extension ||
    segments.length < 2 ||
    segments[0]?.length === 0 ||
    segments
      .slice(0, -1)
      .some((part) => unsafeEarlierExtensions.has(part.toLowerCase()))
  ) {
    throw new FileStorageError("FILE_NAME_INVALID", 400);
  }
  const nonChatExtensions =
    purpose === "MATERIAL"
      ? new Set(["pdf", "docx", "pptx", "xlsx"])
      : evidenceExtensions;
  const allowed = purpose === "CHAT" ? Object.keys(formats) : nonChatExtensions;
  if (
    !(allowed instanceof Set
      ? allowed.has(extension)
      : allowed.includes(extension))
  ) {
    throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
  }
  const mime = formats[extension as keyof typeof formats];
  if (claimedMime.toLowerCase().trim() !== mime || detectedMime !== mime) {
    throw new FileStorageError("FILE_FORMAT_MISMATCH", 415);
  }
  return { extension, detectedMime: mime, sizeBytes, safeName: name };
}
