import { randomUUID } from "node:crypto";
import { apiBase, UserGatewayError } from "./backend";
export function uploadLimit(path: string) {
  if (path === "me/materials/files") return 20_000_000;
  if (/^me\/skills\/[0-9a-f-]{36}\/evidence-files$/i.test(path))
    return 10_000_000;
  return null;
}
export async function userUpload(
  request: Request,
  path: string,
  token: string,
  maxBytes: number,
) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data;"))
    throw new UserGatewayError(415, "MULTIPART_REQUIRED");
  const cap = maxBytes + 65536;
  if (Number(request.headers.get("content-length")) > cap)
    throw new UserGatewayError(413, "FILE_TOO_LARGE");
  if (!request.body) throw new UserGatewayError(400, "FILE_REQUIRED");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > cap) {
        await reader.cancel();
        throw new UserGatewayError(413, "FILE_TOO_LARGE");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new UserGatewayError(400, "INVALID_MULTIPART");
  }
  const entries = [...form.entries()];
  const file = form.get("file");
  if (
    entries.length !== 1 ||
    !file ||
    typeof file === "string" ||
    file.size === 0
  )
    throw new UserGatewayError(400, "FILE_REQUIRED");
  if (file.size > maxBytes) throw new UserGatewayError(413, "FILE_TOO_LARGE");
  let response: Response;
  try {
    response = await fetch(new URL(path, apiBase()), {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60000),
      headers: {
        Authorization: "Bearer " + token,
        "X-Request-Id": randomUUID(),
      },
      body: form,
    });
  } catch {
    throw new UserGatewayError(504, "API_UNAVAILABLE");
  }
  const value = await response.json().catch(() => null);
  if (!value || typeof value !== "object" || !("success" in value))
    throw new UserGatewayError(502, "API_RESPONSE_INVALID");
  return { status: response.status, value };
}
