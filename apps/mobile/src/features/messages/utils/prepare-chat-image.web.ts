import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
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
  try {
    signal.throwIfAborted();
    rendered = await context.renderAsync();
    const jpeg = file.mimeType === "image/jpeg";
    const result = await rendered.saveAsync({
      format: jpeg ? SaveFormat.JPEG : SaveFormat.PNG,
      compress: jpeg ? 0.85 : 1,
      base64: false,
    });
    const blob = await (await fetch(result.uri, { signal })).blob();
    if (signal.aborted || !blob.size || blob.size >= (file.size ?? 0))
      return file;
    const name = file.name.replace(/\.[^.]+$/, jpeg ? ".jpg" : ".png");
    const encoded = new File([blob], name, {
      type: jpeg ? "image/jpeg" : "image/png",
    });
    const uri = URL.createObjectURL(encoded);
    return {
      ...file,
      uri,
      name,
      size: encoded.size,
      mimeType: encoded.type,
      file: encoded,
      cleanup: () => {
        URL.revokeObjectURL(uri);
        file.cleanup?.();
      },
    };
  } catch {
    return file;
  } finally {
    rendered?.release();
    context.release();
  }
}
