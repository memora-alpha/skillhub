import { readBoundedBody } from "./request-body";
import { randomUUID } from "node:crypto";
import { apiBase, UserGatewayError } from "./backend";
import { readBackendReply } from "../gateway/upstream";
export function uploadLimit(path: string) {
  if (path === "me/avatar") return 5 * 1024 * 1024;
  if (path === "reports/evidence-files") return 10_000_000;
  if (/^conversations\/[0-9a-f-]{36}\/attachments$/i.test(path))
    return 15_000_000;
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
  const bodyBytes = await readBoundedBody(
    request.body,
    cap,
    () => new UserGatewayError(413, "FILE_TOO_LARGE"),
  );
  let form: FormData;
  try {
    form = await new Response(bodyBytes, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new UserGatewayError(400, "INVALID_MULTIPART");
  }
  const entries = [...form.entries()];
  const field = path === "me/avatar" ? "image" : "file";
  const file = form.get(field);
  if (
    entries.length !== 1 ||
    entries[0]?.[0] !== field ||
    !file ||
    typeof file === "string" ||
    file.size === 0
  )
    throw new UserGatewayError(400, "FILE_REQUIRED");
  if (file.size > maxBytes) throw new UserGatewayError(413, "FILE_TOO_LARGE");
  if (
    path === "me/avatar" &&
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new UserGatewayError(415, "INVALID_AVATAR_TYPE");
  const url = new URL(path, apiBase());
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60000),
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        "X-Request-Id": randomUUID(),
      },
      body: form,
    });
  } catch {
    throw new UserGatewayError(504, "API_UNAVAILABLE");
  }
  const result = await readBackendReply(response);
  if (!result.value) throw new UserGatewayError(502, "API_RESPONSE_INVALID");
  return { status: result.status, value: result.value };
}
