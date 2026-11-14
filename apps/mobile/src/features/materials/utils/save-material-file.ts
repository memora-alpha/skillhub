import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { materialDownloadName } from "./material-download-name";

export type MaterialDownloadTarget = (
  url: string,
  signal: AbortSignal,
) => Promise<void>;

// Select a destination before requesting an entitlement-consuming URL.
export async function prepareMaterialDownload(): Promise<
  MaterialDownloadTarget | undefined
> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (
      error instanceof Error &&
      /cancel|cancell|dismiss/i.test(`${error.name} ${error.message}`)
    )
      return;
    throw error;
  }
  return async (url, signal) => {
    const temporary = new Directory(Paths.cache, `material-${randomUUID()}`);
    temporary.create();
    let target: File | undefined;
    try {
      const downloaded = await File.downloadFileAsync(url, temporary, {
        signal,
      });
      signal.throwIfAborted();
      const name = materialDownloadName(downloaded.name);
      target = directory.createFile(
        `${randomUUID().slice(0, 8)}-${name}`,
        downloaded.type || null,
      );
      await downloaded.copy(target, { overwrite: true });
      signal.throwIfAborted();
    } catch (error) {
      if (target?.exists) target.delete();
      throw error;
    } finally {
      if (temporary.exists) temporary.delete();
    }
  };
}
