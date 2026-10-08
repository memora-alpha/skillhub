import axios, { type AxiosInstance } from "axios";
import { AppError } from "./errors";
import { readPayload } from "./response";

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
  http: AxiosInstance = axios.create({
    timeout: 20_000,
    validateStatus: () => true,
  }),
) {
  let session: SessionTransport | undefined;
  async function send(
    path: string,
    options: RequestOptions,
    token: string | null,
  ) {
    try {
      const response = await http.request({
        baseURL: baseUrl(),
        url: path,
        method: options.method ?? "GET",
        headers: {
          Accept: "application/json",
          ...(options.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        data: options.body,
      });
      return readPayload(response.status, response.data);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (axios.isAxiosError(error) && error.response)
        return readPayload(error.response.status, error.response.data);
      throw new AppError("network");
    }
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
