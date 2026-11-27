import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { FileSelectionError } from "@/lib/http/picked-image";
import { chatFormats, validateChatFile, type ChatFile } from "./chat-file";

export type ChatImagePaste =
  | Readonly<{ uris: readonly string[] }>
  | Readonly<{ files: readonly globalThis.File[] }>;

// The event supplies the bytes the user pasted; do not read a newer clipboard.
export function importPastedChatImage(
  image: ChatImagePaste,
): Promise<ChatFile> {
  return Promise.resolve().then(() => readPastedChatImage(image));
}

function readPastedChatImage(image: ChatImagePaste): ChatFile {
  if (!("uris" in image))
    throw new FileSelectionError("Không đọc được ảnh đã dán.");
  const { uris } = image;
  if (uris.length !== 1)
    throw new FileSelectionError("Mỗi lần chỉ gửi được một ảnh.");
  const uri = uris[0]!;
  if (!uri.startsWith("file://"))
    throw new FileSelectionError("Không đọc được ảnh đã dán.");
  const source = new File(uri);
  const extension = source.name.split(".").at(-1)?.toLowerCase() ?? "";
  const mimeType = chatFormats[extension];
  if (!mimeType?.startsWith("image/"))
    throw new FileSelectionError("Chỉ dán ảnh JPG, PNG hoặc WebP.");
  validateChatFile({
    name: `anh-da-dan.${extension}`,
    uri,
    mimeType,
    size: source.size,
  });
  const owned = new File(
    Paths.cache,
    `chat-paste-${randomUUID()}.${extension}`,
  );
  try {
    source.copy(owned);
    return {
      name: `anh-da-dan.${extension}`,
      uri: owned.uri,
      previewUri: owned.uri,
      mimeType,
      size: owned.size,
      cleanup: () => {
        if (owned.exists) owned.delete();
      },
    };
  } catch (error) {
    if (owned.exists) owned.delete();
    throw error;
  }
}
