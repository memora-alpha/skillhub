import { Injectable, UnsupportedMediaTypeException } from "@nestjs/common";
import sharp from "sharp";
import { AvatarInspector } from "../../application/ports/avatar-providers";
@Injectable()
export class SharpAvatarInspector extends AvatarInspector {
  async inspect(data: Buffer): Promise<string> {
    try {
      const image = sharp(data, {
        limitInputPixels: 20000000,
        failOn: "warning",
        animated: false,
      });
      const metadata = await image.metadata();
      if (
        !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
        (metadata.pages ?? 1) > 1
      )
        throw new Error("Unsupported image format or multiple pages");
      // Decode all pixels: metadata alone does not reject truncated images.
      await image.raw().toBuffer();
      return metadata.format === "jpeg"
        ? "image/jpeg"
        : `image/${metadata.format}`;
    } catch {
      throw new UnsupportedMediaTypeException("INVALID_IMAGE");
    }
  }
}
