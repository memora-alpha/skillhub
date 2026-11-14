import type { DocumentPickerAsset } from "expo-document-picker";
import { FileSelectionError } from "@/lib/http/picked-image";

export const materialMimeTypes: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export const materialFileTypes = Object.values(materialMimeTypes);
export const materialFileFormats =
  "PDF (.pdf), Word (.docx), Excel (.xlsx) hoặc PowerPoint (.pptx)";

export function prepareMaterialUpload(
  asset: DocumentPickerAsset,
): DocumentPickerAsset {
  const extension = asset.name.split(".").at(-1)?.toLowerCase() ?? "";
  const mime = Object.hasOwn(materialMimeTypes, extension)
    ? materialMimeTypes[extension]
    : undefined;
  if (!mime)
    throw new FileSelectionError(
      extension === "doc"
        ? "Tệp Word .doc chưa được hỗ trợ. Hãy lưu thành .docx rồi chọn lại."
        : `Chọn tệp ${materialFileFormats}.`,
    );
  const claims = [asset.mimeType, asset.file?.type].map((type) =>
    (type ?? "").trim().toLowerCase(),
  );
  if (
    claims.some(
      (type) => type && type !== "application/octet-stream" && type !== mime,
    )
  )
    throw new FileSelectionError(
      "Định dạng tệp không khớp với tên tệp. Hãy mở và xuất lại tệp gốc rồi chọn lại.",
    );
  // Some iOS file providers cannot supply a specific MIME. The server still
  // inspects the bytes; this only supplies the metadata required by multipart.
  const file =
    asset.file && asset.file.type !== mime
      ? new File([asset.file], asset.file.name, {
          type: mime,
          lastModified: asset.file.lastModified,
        })
      : asset.file;
  return { ...asset, mimeType: mime, ...(file ? { file } : {}) };
}
