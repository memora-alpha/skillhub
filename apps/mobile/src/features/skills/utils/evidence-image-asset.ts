import type { ImagePickerAsset } from "expo-image-picker";
import { evidenceFormats, type EvidenceAsset } from "./evidence-draft";

export function evidenceImageAsset(asset: ImagePickerAsset): EvidenceAsset {
  const uriExtension = asset.uri
    .split(/[?#]/)[0]
    ?.split(".")
    .at(-1)
    ?.toLowerCase();
  const nameExtension = asset.fileName?.split(".").at(-1)?.toLowerCase();
  const mime = (
    asset.file?.type ||
    asset.mimeType ||
    evidenceFormats[uriExtension ?? ""] ||
    evidenceFormats[nameExtension ?? ""] ||
    ""
  )
    .toLowerCase()
    .replace("image/jpg", "image/jpeg");
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new Error("Chọn ảnh JPG, PNG hoặc WebP.");
  const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  // The picker may return a converted JPEG with the original HEIC filename.
  let name = `bang-chung.${extension}`;
  if (asset.fileName) {
    name = asset.fileName;
    if (evidenceFormats[nameExtension ?? ""] !== mime)
      name = `${asset.fileName.replace(/\.[^.]*$/, "")}.${extension}`;
  }
  return {
    uri: asset.uri,
    name,
    mimeType: mime,
    size: asset.fileSize,
    file: asset.file,
  };
}
