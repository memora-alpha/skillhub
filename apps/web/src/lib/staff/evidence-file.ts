const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};
const materialExtensions: Record<string, string> = {
  ...extensions,
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
};
export function evidenceMime(type: string): string {
  return type.split(";")[0]!.trim().toLowerCase();
}
export function evidencePreviewKind(
  type: string,
): "image" | "pdf" | "unsupported" {
  const mime = evidenceMime(type);
  if (["image/jpeg", "image/png", "image/webp"].includes(mime)) return "image";
  return mime === "application/pdf" ? "pdf" : "unsupported";
}
export function allowedEvidenceMime(type: string): boolean {
  return Object.hasOwn(extensions, evidenceMime(type));
}
export function allowedMaterialMime(type: string): boolean {
  return Object.hasOwn(materialExtensions, evidenceMime(type));
}
export function evidenceFilename(name: string, mime: string): string {
  const extension = materialExtensions[evidenceMime(mime)] ?? "bin";
  const cleaned =
    [...name]
      .map((char) => {
        const code = char.codePointAt(0)!;
        return code < 32 || code === 127 || /[\\/<>:"|?*]/u.test(char)
          ? "_"
          : char;
      })
      .join("")
      .trim()
      .replace(/^\.+/u, "")
      .slice(0, 180) || "bang-chung";
  return cleaned.toLowerCase().endsWith(`.${extension}`)
    ? cleaned
    : `${cleaned}.${extension}`;
}
