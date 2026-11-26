export function avatarFileError(file: Pick<File, "size" | "type">) {
  if (!file.size || file.size > 5 * 1024 * 1024)
    return "Ảnh cần có dung lượng từ 1 byte đến 5 MB.";
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ? undefined
    : "Chọn ảnh JPEG, PNG hoặc WebP.";
}

export async function validateAvatarPixels(file: File) {
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 20_000_000)
      throw new Error("Ảnh đại diện cần có độ phân giải tối đa 20 megapixel.");
  } finally {
    image.close();
  }
}
