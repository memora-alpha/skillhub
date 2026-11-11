import type { ImagePickerAsset } from "expo-image-picker";
import type { DocumentPickerAsset } from "expo-document-picker";

export class FileSelectionError extends Error {}

const formats: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export function photoUploadAsset(asset: ImagePickerAsset): DocumentPickerAsset {
  const extension = asset.uri
    .split(/[?#]/)[0]
    ?.split(".")
    .at(-1)
    ?.toLowerCase();
  const nameExtension = asset.fileName?.split(".").at(-1)?.toLowerCase();
  const mime = (
    asset.file?.type ||
    asset.mimeType ||
    formats[extension ?? ""] ||
    formats[nameExtension ?? ""] ||
    ""
  )
    .toLowerCase()
    .replace("image/jpg", "image/jpeg");
  if (!asset.uri || !["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new FileSelectionError("Chọn ảnh JPG, PNG hoặc WebP.");
  const suffix = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  const name =
    asset.fileName && formats[nameExtension ?? ""] === mime
      ? asset.fileName
      : `${asset.fileName?.replace(/\.[^.]*$/, "") || "bang-chung"}.${suffix}`;
  return {
    uri: asset.uri,
    name,
    mimeType: mime,
    size: asset.file?.size ?? asset.fileSize,
    file: asset.file,
    lastModified: asset.file?.lastModified ?? Date.now(),
  };
}
