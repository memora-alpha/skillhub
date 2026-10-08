import { AppError } from "./errors";
import { readResponse } from "./response";

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  authenticated?: boolean;
};
export type SessionTransport = {
  getToken: () => Promise<string | null>;
  renew: (staleToken: string) => Promise<void>;
  expire: () => Promise<void>;
};

export function createHttpClient(
  baseUrl: () => string,
  fetcher: typeof fetch = fetch,
) {
  let session: SessionTransport | undefined;
  async function send(
    path: string,
    options: RequestOptions,
    token: string | null,
  ) {
    const url = `${baseUrl()}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetcher(url, {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/json",
          ...(options.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      throw new AppError("network");
    } finally {
      clearTimeout(timeout);
    }
    return readResponse(response);
  }
  return {
    bindSession(transport: SessionTransport) {
      session = transport;
    },
    async request(
      path: string,
      options: RequestOptions = {},
    ): Promise<unknown> {
      if (!path.startsWith("/") || path.startsWith("//"))
        throw new AppError("config");
      const token = options.authenticated ? await session?.getToken() : null;
      if (options.authenticated && !token) throw new AppError("session");
      try {
        return await send(path, options, token ?? null);
      } catch (error) {
        if (!options.authenticated || !(error instanceof AppError)) throw error;
        if (error.status !== 401) {
          if (error.code === "ACCOUNT_NOT_ACTIVE") await session?.expire();
          throw error;
        }
        await session?.renew(token!);
        const nextToken = await session?.getToken();
        if (!nextToken) throw new AppError("session");
        try {
          return await send(path, options, nextToken);
        } catch (retryError) {
          if (retryError instanceof AppError && retryError.status === 401)
            await session?.expire();
          throw retryError;
        }
      }
    },
  };
}
export type HttpClient = ReturnType<typeof createHttpClient>;
