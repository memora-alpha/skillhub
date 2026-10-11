import axios, { type AxiosInstance } from "axios";
import { AppError } from "./errors";
import { readPayload, readPagePayload, type Page } from "./response";
import { connectionStore } from "../network/connection-store";

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  multipart?: boolean;
  authenticated?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
  paginated?: boolean;
  replayAfterRenewal?: boolean;
};
export type SessionTransport = {
  readonly generation: number;
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
    const read = options.paginated ? readPagePayload : readPayload;
    if (options.signal?.aborted) throw new AppError("session");
    if (
      options.idempotencyKey &&
      (options.multipart ||
        !["POST", "PATCH"].includes(options.method ?? "GET"))
    )
      throw new AppError("config");
    try {
      const response = await http.request({
        baseURL: baseUrl(),
        url: path,
        method: options.method ?? "GET",
        headers: {
          Accept: "application/json",
          ...(options.body === undefined
            ? {}
            : {
                "Content-Type": options.multipart ? false : "application/json",
              }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
        },
        data: options.body,
        signal: options.signal,
      });
      return read(response.status, response.data);
    } catch (error) {
      if (options.signal?.aborted || axios.isCancel(error))
        throw new AppError("session");
      if (error instanceof AppError) throw error;
      if (axios.isAxiosError(error) && error.response)
        return read(error.response.status, error.response.data);
      throw new AppError("network");
    }
  }
  const client = {
    bindSession(transport: SessionTransport) {
      session = transport;
    },
    async request(
      path: string,
      options: RequestOptions = {},
    ): Promise<unknown> {
      if (!path.startsWith("/") || path.startsWith("//"))
        throw new AppError("config");
      if (!options.authenticated) return send(path, options, null);
      const transport = session;
      if (!transport) throw new AppError("session");
      const generation = transport.generation;
      const assertCurrentSession = () => {
        if (session !== transport || transport.generation !== generation)
          throw new AppError("session");
      };
      const token = await transport.getToken();
      assertCurrentSession();
      if (!token) throw new AppError("session");
      try {
        const result = await send(path, options, token);
        assertCurrentSession();
        return result;
      } catch (error) {
        assertCurrentSession();
        if (!(error instanceof AppError)) throw error;
        if (error.status !== 401) {
          if (error.code === "ACCOUNT_NOT_ACTIVE") await transport.expire();
          throw error;
        }
        await transport.renew(token);
        assertCurrentSession();
        // Upload bytes are not an idempotent JSON intent. Let the owner retry.
        if (options.replayAfterRenewal === false) throw error;
        const nextToken = await transport.getToken();
        assertCurrentSession();
        if (!nextToken) throw new AppError("session");
        try {
          const result = await send(path, options, nextToken);
          assertCurrentSession();
          return result;
        } catch (retryError) {
          assertCurrentSession();
          if (
            retryError instanceof AppError &&
            (retryError.status === 401 ||
              retryError.code === "ACCOUNT_NOT_ACTIVE")
          )
            await transport.expire();
          throw retryError;
        }
      }
    },
  };
  const request: typeof client.request = async (path, options) => {
    try {
      return await client.request(path, options);
    } catch (error) {
      if (error instanceof AppError && error.kind === "network")
        connectionStore.unavailable();
      throw error;
    }
  };
  return {
    ...client,
    request,
    requestPage: async (path: string, options: RequestOptions = {}) =>
      (await request(path, {
        ...options,
        paginated: true,
      })) as Page<unknown>,
  };
}
export type HttpClient = Pick<
  ReturnType<typeof createHttpClient>,
  "bindSession" | "request"
>;
export type PaginatedHttpClient = ReturnType<typeof createHttpClient>;
