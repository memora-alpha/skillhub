/** Next may normalize request.url to its bind hostname; Host is the browser's actual target. */
export function sameOriginMutation(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const target = new URL(request.url);
    const host = request.headers.get("host");
    if (host) {
      // Do not consume X-Forwarded-Host: only the request's actual Host is relevant here.
      if (/[\s\/@\\?#]/.test(host)) return false;
      target.host = host;
    }
    return origin === target.origin;
  } catch {
    return false;
  }
}
