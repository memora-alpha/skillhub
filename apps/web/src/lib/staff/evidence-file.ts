const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
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
export function evidenceFilename(name: string, mime: string): string {
  const extension = extensions[evidenceMime(mime)] ?? "bin";
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
