import type { DocumentPickerAsset } from "expo-document-picker";
import { FileSelectionError } from "@/lib/http/picked-image";

const mimes: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export const materialCoverTypes = ["image/jpeg", "image/png", "image/webp"];
export function prepareMaterialCoverUpload(
  asset: DocumentPickerAsset,
): DocumentPickerAsset {
  const extension = asset.name.split(".").at(-1)?.toLowerCase() ?? "";
  const mime = Object.hasOwn(mimes, extension) ? mimes[extension] : undefined;
  if (!mime) throw new FileSelectionError("Chọn ảnh bìa JPEG, PNG hoặc WEBP.");
  if (
    [asset.mimeType, asset.file?.type].some(
      (type) =>
        type &&
        type !== "application/octet-stream" &&
        type.toLowerCase() !== mime,
    )
  )
    throw new FileSelectionError(
      "Định dạng ảnh không khớp với tên tệp. Hãy xuất lại ảnh rồi chọn lại.",
    );
  const file =
    asset.file && asset.file.type !== mime
      ? new File([asset.file], asset.file.name, {
          type: mime,
          lastModified: asset.file.lastModified,
        })
      : asset.file;
  return { ...asset, mimeType: mime, ...(file ? { file } : {}) };
}
