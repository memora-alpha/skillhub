import { AppError } from "./errors";

// Only static API segments are logged. IDs, query values, bodies and headers
// never enter technical logs (including paths with non-UUID IDs).
const segments = new Set(
  (
    "auth login refresh logout account me users profiles avatar assets status " +
    "sessions mine requests learning-requests feed recommended skills tags " +
    "sharing-skills verifications conversations messages proposals notifications " +
    "learning-paths learning-plans wallet balance transactions payments events " +
    "attachments delivery read download-url upload-url policy reputation"
  ).split(" "),
);

function endpoint(path: string) {
  return path
    .split(/[?#]/, 1)[0]!
    .split("/")
    .map((part) => (!part || segments.has(part) ? part : ":id"))
    .join("/");
}

export function createRequestDiagnostics(
  enabled: () => boolean,
  emit: (message: string) => void,
  now = Date.now,
) {
  const reported = new Map<string, number>();
  return {
    failed(
      path: string,
      method: string,
      error: unknown,
      source: "server" | "client-cooldown",
    ) {
      if (
        !enabled() ||
        source !== "server" ||
        !(error instanceof AppError) ||
        !(
          error.kind === "network" ||
          error.status === 429 ||
          error.status >= 500
        )
      )
        return;
      const at = now();
      const request = `${method} ${endpoint(path)}`;
      for (const [key, until] of reported)
        if (until <= at) reported.delete(key);
      const key = `${request}:${error.status}:${error.code}`;
      if ((reported.get(key) ?? 0) > at) return;
      reported.set(key, Math.max(at + 60_000, error.retryAt));
      emit(
        JSON.stringify({
          request,
          status: error.status,
          kind: error.kind,
          code: /^[A-Z_]{1,80}$/.test(error.code) ? error.code : "UNKNOWN",
          clientWaitSeconds: Math.max(
            0,
            Math.ceil((error.retryAt - at) / 1000),
          ),
        }),
      );
    },
  };
}

export const requestDiagnostics = createRequestDiagnostics(
  () => typeof __DEV__ !== "undefined" && __DEV__,
  (message) => console.info("[http:read]", message),
);
