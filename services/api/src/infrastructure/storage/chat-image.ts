import { Readable } from "node:stream";
import { Logger } from "@nestjs/common";
import sharp from "sharp";
import type { ObjectStorage } from "./object-storage.port";

export type ChatImageVariant = "preview" | "thumbnail";
export const chatImageMime = "image/webp";
const sizes = { thumbnail: 320, preview: 1280 } as const;
const logger = new Logger("ChatImage");

export function chatImageKey(objectKey: string, variant: ChatImageVariant) {
  return `${objectKey}.chat-image-v1-${variant}.webp`;
}

export async function prepareChatImage(
  objects: ObjectStorage,
  objectKey: string,
  bytes: Buffer,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const started = performance.now();
  const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: true });
  const { autoOrient, pages } = await image.metadata();
  logger.log({
    image_metadata_duration_ms: Math.round(performance.now() - started),
  });
  if ((pages ?? 1) > 1 || !autoOrient.width || !autoOrient.height) return;
  await Promise.all(
    Object.entries(sizes).map(async ([variant, size]) => {
      signal?.throwIfAborted();
      const derivative = await image
        .clone()
        .rotate()
        .resize(size, size, { fit: "inside", withoutEnlargement: true })
        .webp()
        .timeout({ seconds: 10 })
        .toBuffer();
      await objects.put(
        chatImageKey(objectKey, variant as ChatImageVariant),
        Readable.from(derivative),
        chatImageMime,
        signal,
      );
    }),
  );
  return { width: autoOrient.width, height: autoOrient.height };
}

export function chatImageDimensions(assessment: unknown) {
  if (!assessment || typeof assessment !== "object" || !("image" in assessment))
    return null;
  const { image } = assessment;
  if (
    !image ||
    typeof image !== "object" ||
    !("width" in image) ||
    !("height" in image) ||
    typeof image.width !== "number" ||
    typeof image.height !== "number"
  )
    return null;
  return { width: image.width, height: image.height };
}
