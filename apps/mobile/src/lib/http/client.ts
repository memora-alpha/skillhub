import axios, { type AxiosInstance } from "axios";
import { AppError } from "./errors";
import { readPayload, readPagePayload, type Page } from "./response";
import { connectionStore } from "../network/connection-store";
import { RequestCoordinator, retryAfterAt } from "./rate-limit";
import { requestDiagnostics } from "./request-diagnostics";

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  multipart?: boolean;
  authenticated?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
  paginated?: boolean;
  replayAfterRenewal?: boolean;
  includeMeta?: boolean;
};
export type SessionTransport = {
  readonly generation: number;
  getToken: () => Promise<string | null>;
  renew: (staleToken: string) => Promise<void>;
  expire: () => Promise<void>;
};

function requestHeaders(options: RequestOptions, token: string | null) {
  const headers: Record<string, string | boolean> = {
    Accept: "application/json",
  };
  if (options.body !== undefined)
    headers["Content-Type"] = options.multipart ? false : "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey)
    headers["Idempotency-Key"] = options.idempotencyKey;
  return headers;
}

export function createHttpClient(
  baseUrl: () => string,
  http: AxiosInstance = axios.create({
    timeout: 20_000,
    validateStatus: () => true,
  }),
) {
  let session: SessionTransport | undefined;
  const guestRequests = new RequestCoordinator();
  let authenticatedRequests = new RequestCoordinator();
  let requestsGeneration = -1;
  const requestPolicy = () => {
    if (requestsGeneration !== session?.generation) {
      requestsGeneration = session?.generation ?? -1;
      authenticatedRequests = new RequestCoordinator();
    }
    return authenticatedRequests;
  };
  async function send(
    path: string,
    options: RequestOptions,
    token: string | null,
    policy: RequestCoordinator,
    assertCurrent: () => void = () => {},
  ) {
    let attempted = false;
    const read = (status: number, payload: unknown, retryAt = 0) =>
      options.paginated
        ? readPagePayload(status, payload, retryAt)
        : readPayload(status, payload, options.includeMeta, retryAt);
    if (options.signal?.aborted) throw new AppError("session");
    if (
      options.idempotencyKey &&
      (options.multipart ||
        !["POST", "PATCH"].includes(options.method ?? "GET"))
    )
      throw new AppError("config");
    try {
      return await policy.run(
        path,
        options.method ?? "GET",
        options.signal,
        async () => {
          assertCurrent();
          attempted = true;
          const response = await http.request({
            baseURL: baseUrl(),
            url: path,
            method: options.method ?? "GET",
            headers: requestHeaders(options, token),
            data: options.body,
            signal: options.signal,
          });
          return read(
            response.status,
            response.data,
            response.status === 429
              ? retryAfterAt(response.headers["retry-after"])
              : 0,
          );
        },
      );
    } catch (error) {
      if (options.signal?.aborted || axios.isCancel(error))
        throw new AppError("session");
      if (error instanceof AppError) {
        requestDiagnostics.failed(
          path,
          options.method ?? "GET",
          error,
          attempted ? "server" : "client-cooldown",
        );
        throw error;
      }
      if (axios.isAxiosError(error) && error.response) {
        try {
          return read(
            error.response.status,
            error.response.data,
            error.response.status === 429
              ? retryAfterAt(error.response.headers["retry-after"])
              : 0,
          );
        } catch (responseError) {
          requestDiagnostics.failed(
            path,
            options.method ?? "GET",
            responseError,
            "server",
          );
          policy.record(path, options.method ?? "GET", responseError);
          throw responseError;
        }
      }
      const failure = new AppError("network");
      requestDiagnostics.failed(
        path,
        options.method ?? "GET",
        failure,
        "server",
      );
      throw failure;
    }
  }
  const client = {
    bindSession(transport: SessionTransport) {
      session = transport;
      requestsGeneration = -1;
    },
    requestPolicy,
    async request(
      path: string,
      options: RequestOptions = {},
    ): Promise<unknown> {
      if (!path.startsWith("/") || path.startsWith("//"))
        throw new AppError("config");
      if (!options.authenticated)
        return send(path, options, null, guestRequests);
      const transport = session;
      if (!transport) throw new AppError("session");
      const generation = transport.generation;
      const policy = requestPolicy();
      const assertCurrentSession = () => {
        if (session !== transport || transport.generation !== generation)
          throw new AppError("session");
      };
      const token = await transport.getToken();
      assertCurrentSession();
      if (!token) throw new AppError("session");
      try {
        const result = await send(
          path,
          options,
          token,
          policy,
          assertCurrentSession,
        );
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
          const result = await send(
            path,
            options,
            nextToken,
            policy,
            assertCurrentSession,
          );
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
