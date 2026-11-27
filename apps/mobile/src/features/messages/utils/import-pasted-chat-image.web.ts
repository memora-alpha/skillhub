import { FileSelectionError } from "@/lib/http/picked-image";
import { validateChatFile, type ChatFile } from "./chat-file";
import type { ChatImagePaste } from "./import-pasted-chat-image";

export function importPastedChatImage(
  image: ChatImagePaste,
): Promise<ChatFile> {
  return Promise.resolve().then(() => readPastedChatImage(image));
}

function readPastedChatImage(image: ChatImagePaste): ChatFile {
  if (!("files" in image) || image.files.length !== 1)
    throw new FileSelectionError("Mỗi lần chỉ gửi được một ảnh.");
  const file = image.files[0]!;
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type];
  if (!extension)
    throw new FileSelectionError("Chỉ dán ảnh JPG, PNG hoặc WebP.");
  const next = {
    name: `anh-da-dan.${extension}`,
    uri: "",
    mimeType: file.type,
    size: file.size,
    file,
  };
  validateChatFile(next);
  const uri = URL.createObjectURL(file);
  return {
    ...next,
    uri,
    previewUri: uri,
    cleanup: () => URL.revokeObjectURL(uri),
  };
}
