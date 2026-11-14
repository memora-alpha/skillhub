import { materialWebDownloadName } from "./material-web-download-name";

export type MaterialDownloadTarget = (
  url: string,
  signal: AbortSignal,
) => Promise<void>;

export async function prepareMaterialDownload(): Promise<
  MaterialDownloadTarget | undefined
> {
  return async (url, signal) => {
    const response = await fetch(url, { signal, credentials: "omit" });
    if (!response.ok) throw new Error("Material download failed");
    const blob = await response.blob();
    signal.throwIfAborted();
    const filename = materialWebDownloadName(
      response.headers.get("Content-Disposition"),
      blob.type,
    );
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  };
}
