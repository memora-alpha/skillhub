import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";

export type ChatMediaFile = { uri: string; dispose(): void };

export function createChatMediaFile(
  bytes: Uint8Array,
  mime: string,
): ChatMediaFile {
  const directory = new Directory(Paths.cache, "chat-preview");
  directory.create({ intermediates: true, idempotent: true });
  const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  const file = new File(directory, `${randomUUID()}.${extension}`);
  try {
    file.write(bytes);
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
  return {
    uri: file.uri,
    dispose: () => {
      if (file.exists) file.delete();
    },
  };
}

export async function prepareChatDownload(filename: string, mime: string) {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (
      error instanceof Error &&
      /cancel|dismiss/i.test(`${error.name} ${error.message}`)
    )
      return;
    throw error;
  }
  return async (bytes: Uint8Array, signal: AbortSignal) => {
    signal.throwIfAborted();
    const name =
      [...filename]
        .map((char) => {
          const code = char.codePointAt(0)!;
          return code < 32 || code === 127 || char === "/" || char === "\\"
            ? "_"
            : char;
        })
        .join("")
        .replace(/^\.+/, "_")
        .slice(0, 140) || "tep";
    const file = directory.createFile(
      `${randomUUID().slice(0, 8)}-${name}`,
      mime,
    );
    try {
      await file.write(bytes);
      signal.throwIfAborted();
    } catch (error) {
      if (file.exists) file.delete();
      throw error;
    }
  };
}
