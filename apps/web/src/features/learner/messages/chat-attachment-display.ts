import type { MessageAttachment } from "../types";

export type AttachmentBadgeTone = "doc" | "pdf" | "text" | "image" | "file";

export type AttachmentBadgeInfo = {
  ext: string;
  tone: AttachmentBadgeTone;
};

export type ImageBoxDimensions = {
  width: number;
  height: number;
  cropped: boolean;
};

export type PartitionedAttachments = {
  images: MessageAttachment[];
  files: MessageAttachment[];
  restricted: MessageAttachment[];
};

const KB = 1024;
const MB = 1024 * 1024;
const MAX_SINGLE_IMAGE_WIDTH = 296;
const MAX_SINGLE_IMAGE_HEIGHT = 300;
const MIN_SINGLE_IMAGE_WIDTH = 120;
const MIN_SINGLE_IMAGE_HEIGHT = 96;
const MIN_INLINE_ASPECT = 0.45;
const MAX_INLINE_ASPECT = 2.4;

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/msword": "DOC",
  "text/plain": "TXT",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
};

export function isBlockedAttachment(file: MessageAttachment): boolean {
  const status = file.accessStatus ?? file.availability;
  return status === "REVOKED" || file.moderationStatus === "BLOCKED";
}

export function isImageAttachment(file: MessageAttachment): boolean {
  return (
    file.attachmentType === "IMAGE" ||
    Boolean(file.mimeType?.startsWith("image/"))
  );
}

export function attachmentStatusMessage(
  file: MessageAttachment,
): string | null {
  if (isBlockedAttachment(file)) {
    return file.restrictionReason === "REVOKED"
      ? "Tệp đã bị kiểm duyệt viên thu hồi quyền tải."
      : "Tệp đã bị chặn do vi phạm tiêu chuẩn cộng đồng.";
  }
  const status = file.accessStatus ?? file.availability;
  if (!status || status === "AVAILABLE") return null;
  if (status === "PENDING_SCAN") {
    return "Đang kiểm tra an toàn tệp. Tệp sẽ mở tải sau khi hoàn tất.";
  }
  return "Tệp hiện không khả dụng.";
}

/**
 * Prevents leaking profane or unmoderated filenames in chat history:
 * - Blocked/revoked attachments never expose the original filename to anyone.
 * - Unapproved (pending/unavailable) attachments never expose raw filenames to recipients.
 */
export function visibleAttachmentFilename(
  file: MessageAttachment,
  mine: boolean,
): string {
  if (isBlockedAttachment(file)) {
    return file.restrictionReason === "REVOKED"
      ? "Tệp đính kèm đã bị thu hồi"
      : "Tệp đính kèm đã bị chặn";
  }
  const status = file.accessStatus ?? file.availability;
  if (!mine && status && status !== "AVAILABLE") {
    return status === "PENDING_SCAN"
      ? "Tệp đính kèm đang kiểm tra"
      : "Tệp đính kèm không khả dụng";
  }
  return file.filename;
}

export function formatAttachmentSize(bytes?: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < KB) return `${Math.round(bytes)} B`;
  if (bytes < MB) {
    const kb = bytes / KB;
    const formatted = new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: kb < 10 ? 1 : 0,
    }).format(kb);
    return `${formatted} KB`;
  }
  const mb = bytes / MB;
  const formatted = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: mb < 10 ? 1 : 0,
  }).format(mb);
  return `${formatted} MB`;
}

function extractExtension(filename: string, mimeType?: string): string | null {
  const match = /\.([a-z0-9]{1,5})$/i.exec(filename.trim());
  if (match?.[1]) {
    const upper = match[1].toUpperCase();
    return upper === "JPEG" ? "JPG" : upper;
  }
  if (mimeType) {
    const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
    if (MIME_TO_EXT[normalized]) return MIME_TO_EXT[normalized];
  }
  return null;
}

export function attachmentBadgeInfo(
  file: Pick<MessageAttachment, "filename" | "mimeType" | "attachmentType">,
): AttachmentBadgeInfo {
  const rawExt = extractExtension(file.filename, file.mimeType);
  if (rawExt === "DOCX" || rawExt === "DOC") {
    return { ext: rawExt, tone: "doc" };
  }
  if (rawExt === "PDF") {
    return { ext: "PDF", tone: "pdf" };
  }
  if (rawExt === "TXT") {
    return { ext: "TXT", tone: "text" };
  }
  if (
    file.attachmentType === "IMAGE" ||
    file.mimeType?.startsWith("image/") ||
    (rawExt !== null && ["JPG", "PNG", "WEBP", "GIF"].includes(rawExt))
  ) {
    return { ext: (rawExt ?? "IMG").slice(0, 4), tone: "image" };
  }
  return { ext: (rawExt ?? "FILE").slice(0, 4), tone: "file" };
}

export function attachmentMetaText(
  file: Pick<
    MessageAttachment,
    "filename" | "mimeType" | "attachmentType" | "fileSizeBytes"
  >,
): string {
  const { ext } = attachmentBadgeInfo(file);
  const size = formatAttachmentSize(file.fileSizeBytes);
  return size ? `${ext} · ${size}` : ext;
}

export function imageBoxDimensions(
  width?: number | null,
  height?: number | null,
): ImageBoxDimensions | null {
  if (
    width == null ||
    height == null ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  const naturalRatio = width / height;
  const clampedRatio = Math.min(
    MAX_INLINE_ASPECT,
    Math.max(MIN_INLINE_ASPECT, naturalRatio),
  );
  const cropped = Math.abs(clampedRatio - naturalRatio) > 0.01;

  let displayW = width;
  let displayH = width / clampedRatio;

  const downScale = Math.min(
    1,
    MAX_SINGLE_IMAGE_WIDTH / displayW,
    MAX_SINGLE_IMAGE_HEIGHT / displayH,
  );
  displayW *= downScale;
  displayH *= downScale;

  if (displayW < MIN_SINGLE_IMAGE_WIDTH) {
    displayW = MIN_SINGLE_IMAGE_WIDTH;
    displayH = Math.min(
      MAX_SINGLE_IMAGE_HEIGHT,
      Math.max(MIN_SINGLE_IMAGE_HEIGHT, displayW / clampedRatio),
    );
  }
  if (displayH < MIN_SINGLE_IMAGE_HEIGHT) {
    displayH = MIN_SINGLE_IMAGE_HEIGHT;
    displayW = Math.min(
      MAX_SINGLE_IMAGE_WIDTH,
      Math.max(MIN_SINGLE_IMAGE_WIDTH, displayH * clampedRatio),
    );
  }

  return {
    width: Math.round(displayW),
    height: Math.round(displayH),
    cropped,
  };
}

export function partitionMessageAttachments(
  attachments: readonly MessageAttachment[],
): PartitionedAttachments {
  const images: MessageAttachment[] = [];
  const files: MessageAttachment[] = [];
  const restricted: MessageAttachment[] = [];

  for (const file of attachments) {
    if (attachmentStatusMessage(file)) {
      restricted.push(file);
    } else if (isImageAttachment(file)) {
      images.push(file);
    } else {
      files.push(file);
    }
  }
  return { images, files, restricted };
}
