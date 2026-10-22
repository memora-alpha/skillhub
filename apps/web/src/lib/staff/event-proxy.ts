// The browser authenticates only with portal-scoped HttpOnly cookies.
// Never forward upstream response headers/cookies or put a bearer in a URL.
export async function proxyEvents(
  request: Request,
  url: URL,
  token: string,
  transport: typeof fetch = fetch,
): Promise<Response> {
  const failure = (status: number, message: string) =>
    Response.json(
      { success: false, message, statusCode: status },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  const cursor = request.headers.get("last-event-id");
  if (cursor && (cursor.length > 1024 || /[\r\n\0]/.test(cursor)))
    return failure(400, "INVALID_EVENT_CURSOR");
  const abort = new AbortController();
  const stop = () => abort.abort();
  request.signal.addEventListener("abort", stop, { once: true });
  if (request.signal.aborted) stop();
  const timer = setTimeout(stop, 12000);
  const cleanup = () => {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", stop);
    abort.abort();
  };
  try {
    const upstream = await transport(url, {
      cache: "no-store",
      redirect: "error",
      signal: abort.signal,
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
        ...(cursor ? { "Last-Event-ID": cursor } : {}),
      },
    });
    clearTimeout(timer); // Only stream setup times out; heartbeat/replay owns its lifetime.
    if (upstream.status !== 200) {
      await upstream.body?.cancel();
      cleanup();
      const codes: Record<number, string> = {
        400: "INVALID_EVENT_CURSOR",
        401: "SESSION_UNAVAILABLE",
        403: "EVENT_ACCESS_DENIED",
        409: "EVENT_CURSOR_EXPIRED",
        429: "EVENT_CAPACITY_EXCEEDED",
      };
      return failure(
        upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
        codes[upstream.status] ?? "API_UNAVAILABLE",
      );
    }
    if (
      !upstream.headers.get("content-type")?.includes("text/event-stream") ||
      !upstream.body
    ) {
      await upstream.body?.cancel();
      cleanup();
      return failure(502, "API_RESPONSE_INVALID");
    }
    const reader = upstream.body.getReader();
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          try {
            const chunk = await reader.read();
            if (chunk.done) {
              cleanup();
              controller.close();
            } else controller.enqueue(chunk.value);
          } catch (error) {
            cleanup();
            controller.error(error);
          }
        },
        async cancel() {
          cleanup();
          await reader.cancel().catch(() => {});
        },
      },
      { highWaterMark: 0 },
    );
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-store, no-transform",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    cleanup();
    return failure(504, "API_UNAVAILABLE");
  }
}
