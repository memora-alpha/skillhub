import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import type { ChatFile } from "./chat-file";

export const CHAT_IMAGE_COMPRESSION_BYTES = 1_000_000;

export async function prepareChatImage(
  file: ChatFile,
  signal: AbortSignal,
): Promise<ChatFile> {
  if (
    !["image/jpeg", "image/png"].includes(file.mimeType ?? "") ||
    (file.size ?? 0) <= CHAT_IMAGE_COMPRESSION_BYTES
  )
    return file;
  const context = ImageManipulator.manipulate(file.uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let output: File | undefined;
  try {
    signal.throwIfAborted();
    rendered = await context.renderAsync();
    const jpeg = file.mimeType === "image/jpeg";
    // Preserve pixel dimensions and transparency; only JPEG uses lossy encoding.
    const result = await rendered.saveAsync({
      format: jpeg ? SaveFormat.JPEG : SaveFormat.PNG,
      compress: jpeg ? 0.85 : 1,
      base64: false,
    });
    output = new File(result.uri);
    const size = output.size;
    if (signal.aborted || !size || size >= (file.size ?? 0)) return file;
    const owned = output;
    output = undefined;
    return {
      ...file,
      uri: owned.uri,
      size,
      name: file.name.replace(/\.[^.]+$/, jpeg ? ".jpg" : ".png"),
      mimeType: jpeg ? "image/jpeg" : "image/png",
      cleanup: () => {
        if (owned.exists) owned.delete();
        file.cleanup?.();
      },
    };
  } catch {
    // Compression is optional. Keep a valid original on encoder failure.
    return file;
  } finally {
    if (output?.exists) output.delete();
    rendered?.release();
    context.release();
  }
}
