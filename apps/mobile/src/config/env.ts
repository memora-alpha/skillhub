import { AppError } from "../lib/http/errors";

export function normalizeApiUrl(value: string | undefined): string {
  try {
    const url = new URL(value?.trim() ?? "");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid API URL");
    let path = url.pathname.replace(/\/+$/, "");
    if (!path || path === "/api") path = "/api/v1";
    if (path !== "/api/v1") throw new Error("Invalid API path");
    return `${url.origin}${path}`;
  } catch {
    throw new AppError("config");
  }
}

export function getApiUrl() {
  return normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
}
