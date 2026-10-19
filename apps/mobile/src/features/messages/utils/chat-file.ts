export const CHAT_MAX_BYTES = 15_000_000;
export const chatFormats: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export type ChatFile = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  file?: File;
};
export function validateChatFile(file: ChatFile) {
  const parts = file.name.toLowerCase().split(".");
  const mime = chatFormats[parts.at(-1) ?? ""];
  const claimedMime = file.mimeType?.trim().toLowerCase();
  const size = file.file?.size ?? file.size;
  if (
    !mime ||
    !parts[0] ||
    file.name.length > 255 ||
    /[\\/]/.test(file.name) ||
    [...file.name].some(
      (char) => char.codePointAt(0)! <= 31 || char.codePointAt(0)! === 127,
    ) ||
    parts
      .slice(0, -1)
      .some((part) =>
        /^(exe|com|dll|bat|cmd|ps1|js|mjs|html|htm|svg|php|sh|jar|msi)$/.test(
          part,
        ),
      )
  )
    throw new Error(
      "Chọn PDF, Word, Excel, PowerPoint, TXT hoặc ảnh JPG/PNG/WebP hợp lệ.",
    );
  if (!size || !Number.isSafeInteger(size) || size < 1)
    throw new Error("Không đọc được kích thước tệp hoặc tệp rỗng.");
  if (size > CHAT_MAX_BYTES)
    throw new Error("Tệp vượt giới hạn 15 MB (15.000.000 byte).");
  if (
    claimedMime &&
    claimedMime !== "application/octet-stream" &&
    claimedMime !== mime
  )
    throw new Error("Tên và định dạng tệp không khớp.");
  return { mime, size };
}
export function chatFileFormData(file: ChatFile) {
  const { mime } = validateChatFile(file);
  const body = new FormData();
  if (file.file)
    body.append("file", file.file.slice(0, file.file.size, mime), file.name);
  else
    body.append("file", {
      uri: file.uri,
      type: mime,
      name: file.name,
    } as unknown as Blob);
  return body;
}
