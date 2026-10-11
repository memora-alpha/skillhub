import { getApiUrl } from "@/config/env";

export async function probeConnection() {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 7000);
  try {
    // An HTTP response proves connectivity. HTTP errors stay with their feature.
    await fetch(new URL("/api/health", getApiUrl()).toString(), {
      method: "GET",
      signal: abort.signal,
      cache: "no-store",
      credentials: "omit",
    });
  } finally {
    clearTimeout(timer);
  }
}
