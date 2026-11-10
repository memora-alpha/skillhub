import { backendBaseUrl } from "@/lib/gateway/upstream";

export async function GET() {
  let connected = false;
  try {
    const response = await fetch(new URL("/api/health", backendBaseUrl()), {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    connected = response.ok;
    await response.body?.cancel();
  } catch {
    // Do not expose the configured backend address or transport diagnostics.
  }
  return Response.json(
    { connected },
    {
      status: connected ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
