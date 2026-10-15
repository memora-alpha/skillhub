import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File as NativeFile } from "expo-file-system";
import { Platform } from "react-native";
import { createEvidenceCompressor } from "../utils/compress-evidence";

export const compressEvidence = createEvidenceCompressor(async (asset) => {
  const context = ImageManipulator.manipulate(asset.uri);
  let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  try {
    image = await context.renderAsync();
    // Re-encode only: preserve the complete image and its pixel dimensions.
    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.9,
      base64: false,
    });
    const name = `${asset.name.replace(/\.[^.]+$/, "")}.jpg`;
    if (Platform.OS === "web") {
      const blob = await (await fetch(result.uri)).blob();
      if (blob.type !== "image/jpeg")
        throw new Error("Unexpected image format");
      const file = new File([blob], name, { type: "image/jpeg" });
      return {
        uri: result.uri,
        name,
        mimeType: file.type,
        size: file.size,
        file,
      };
    }
    return {
      uri: result.uri,
      name,
      mimeType: "image/jpeg",
      size: new NativeFile(result.uri).size ?? undefined,
    };
  } finally {
    image?.release();
    context.release();
  }
});
