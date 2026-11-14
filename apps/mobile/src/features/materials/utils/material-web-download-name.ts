import { materialDownloadName } from "./material-download-name";
import { materialMimeTypes } from "./material-upload";

export function materialWebDownloadName(
  disposition: string | null,
  mime: string,
) {
  const type = mime.split(";")[0]!.trim().toLowerCase();
  const format = Object.entries(materialMimeTypes).find(
    ([, value]) => value === type,
  )?.[0];
  const extension = format
    ? `.${format}`
    : type.startsWith("image/")
      ? `.${type.split("/")[1]!.replace(/[^a-z0-9]/g, "")}`
      : "";
  let name: string | undefined;
  // Prefer the UTF-8 filename when storage exposes it through CORS.
  const encoded = /filename\*\s*=\s*UTF-8'[^']*'([^;\r\n]+)/i.exec(
    disposition ?? "",
  )?.[1];
  if (encoded) {
    try {
      name = decodeURIComponent(encoded.trim());
    } catch {
      /* Fall back to filename. */
    }
  }
  name ||= /filename\s*=\s*(?:"([^"\r\n]+)"|([^;\r\n]+))/i
    .exec(disposition ?? "")
    ?.slice(1)
    .find(Boolean)
    ?.trim();
  return materialDownloadName(name || `tai-lieu${extension}`);
}
