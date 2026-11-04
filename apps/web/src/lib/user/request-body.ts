export async function readBoundedBody(
  body: ReadableStream<Uint8Array>,
  limit: number,
  tooLarge: () => Error,
) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const stream = {
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        const item = await reader.read();
        return item.done
          ? { done: true as const, value: undefined }
          : { done: false as const, value: item.value };
      },
    }),
  };
  try {
    for await (const chunk of stream) {
      size += chunk.byteLength;
      if (size > limit) throw tooLarge();
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
  } finally {
    reader.releaseLock();
  }
}
