import { AppError } from "./errors";
import { readPayload } from "./response";

function responseBytes(data: unknown) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return undefined;
}

export function readBinaryResponse(
  status: number,
  data: unknown,
  retryAt: number,
) {
  const bytes = responseBytes(data);
  if (status >= 200 && status < 300) {
    if (!bytes?.byteLength) throw new AppError("protocol");
    return bytes;
  }
  let payload = data;
  if (bytes) {
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      payload = undefined;
    }
  }
  return readPayload(status, payload, false, retryAt);
}
