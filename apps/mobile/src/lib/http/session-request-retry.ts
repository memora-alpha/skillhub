import { AppError } from "./errors";
import type { RequestOptions, SessionTransport } from "./client";

export async function retrySessionRequest(options: {
  request: RequestOptions;
  transport: SessionTransport;
  staleToken: string;
  originalError: AppError;
  assertCurrent(): void;
  send(token: string): Promise<unknown>;
}) {
  const { transport, assertCurrent } = options;
  await transport.renew(options.staleToken);
  assertCurrent();
  // Renewal may refresh credentials, but file uploads still need an explicit retry.
  if (options.request.replayAfterRenewal === false) throw options.originalError;
  const token = await transport.getToken();
  assertCurrent();
  if (!token) throw new AppError("session");
  try {
    const result = await options.send(token);
    assertCurrent();
    return result;
  } catch (error) {
    assertCurrent();
    if (
      error instanceof AppError &&
      (error.status === 401 || error.code === "ACCOUNT_NOT_ACTIVE")
    )
      await transport.expire();
    throw error;
  }
}
