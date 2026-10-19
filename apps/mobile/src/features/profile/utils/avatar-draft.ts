import type { ImagePickerAsset } from "expo-image-picker";

export type AvatarImage = {
  uri: string;
  mime: string;
  file?: File;
  name: string;
};
export type AvatarDraft =
  { kind: "upload"; image: AvatarImage } | { kind: "remove" } | null;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export class AvatarSelectionError extends Error {}

export function avatarImage(asset: ImagePickerAsset): AvatarImage {
  const extension = (
    (asset.uri.split(/[?#]/)[0] ?? "").match(/\.(jpe?g|png|webp)$/i)?.[1] ??
    asset.fileName?.match(/\.(jpe?g|png|webp)$/i)?.[1]
  )?.toLowerCase();
  const mime = (
    asset.file?.type ||
    asset.mimeType ||
    (extension ? `image/${extension === "jpg" ? "jpeg" : extension}` : "")
  )
    .toLowerCase()
    .replace("image/jpg", "image/jpeg");
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new AvatarSelectionError("Chọn ảnh JPG, PNG hoặc WebP.");
  const size = asset.file?.size ?? asset.fileSize;
  if (size !== undefined && size > AVATAR_MAX_BYTES)
    throw new AvatarSelectionError("Ảnh đại diện tối đa 5MB.");
  if (size === 0 || !asset.uri)
    throw new AvatarSelectionError("Ảnh không hợp lệ. Hãy chọn ảnh khác.");
  if (asset.width * asset.height > 20_000_000)
    throw new AvatarSelectionError(
      "Ảnh quá lớn. Chọn ảnh không quá 20 megapixel.",
    );
  return {
    uri: asset.uri,
    mime,
    file: asset.file,
    name: `avatar.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`,
  };
}

export function avatarFormData(image: AvatarImage) {
  const body = new FormData();
  if (image.file) body.append("image", image.file, image.name);
  else
    body.append("image", {
      uri: image.uri,
      type: image.mime,
      name: image.name,
    } as unknown as Blob);
  return body;
}
