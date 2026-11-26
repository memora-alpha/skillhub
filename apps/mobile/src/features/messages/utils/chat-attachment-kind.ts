export function isChatImage(mimeType?: string) {
  return /^image\/(jpeg|png|webp)$/i.test(mimeType?.trim() ?? "");
}

export function chatAttachmentNoun(mimeType?: string) {
  return isChatImage(mimeType) ? "ảnh" : "tệp";
}

export function attachmentCopy(copy: string, mimeType?: string) {
  return isChatImage(mimeType)
    ? copy.replace(/(^|[.!?]\s+)Tệp/g, "$1Ảnh").replace(/tệp/g, "ảnh")
    : copy;
}
