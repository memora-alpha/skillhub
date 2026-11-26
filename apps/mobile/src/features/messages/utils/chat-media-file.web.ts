export type ChatMediaFile = { uri: string; dispose(): void };

export function createChatMediaFile(
  bytes: Uint8Array,
  mime: string,
): ChatMediaFile {
  const uri = URL.createObjectURL(
    new Blob([new Uint8Array(bytes).buffer], { type: mime }),
  );
  return { uri, dispose: () => URL.revokeObjectURL(uri) };
}

export function prepareChatDownload(filename: string, mime: string) {
  return Promise.resolve(async (bytes: Uint8Array, signal: AbortSignal) => {
    signal.throwIfAborted();
    const file = createChatMediaFile(bytes, mime);
    const anchor = document.createElement("a");
    try {
      anchor.href = file.uri;
      anchor.download = filename.replace(/[\\/]/g, "_") || "tep";
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      setTimeout(file.dispose, 30_000);
    }
  });
}
