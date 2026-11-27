import type { DocumentPickerAsset } from "expo-document-picker";
import { z } from "zod";
export const fileModerationStatusSchema = z.enum([
  "PENDING",
  "REVIEW_REQUIRED",
  "FAILED",
]);
export type FileModerationStatus = z.infer<typeof fileModerationStatusSchema>;
export const uploadedFileSchema = z.object({
  fileId: z.uuid(),
  state: z.string().min(1),
});
export type UploadedFile = z.infer<typeof uploadedFileSchema> & {
  name: string;
  moderationStatus?: FileModerationStatus;
};
export type UploadStatus = Pick<
  UploadedFile,
  "fileId" | "state" | "moderationStatus"
>;
export function uploadBody(asset: DocumentPickerAsset) {
  const body = new FormData();
  if (asset.file) body.append("file", asset.file, asset.name);
  else
    body.append("file", {
      uri: asset.uri,
      type: asset.mimeType ?? "application/octet-stream",
      name: asset.name,
    } as unknown as Blob);
  return body;
}
