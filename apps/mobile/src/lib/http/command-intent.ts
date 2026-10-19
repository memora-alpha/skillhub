import { AppError } from "./errors";

export function isConnectionPolicyUnavailable(
  error: unknown,
): error is AppError {
  return (
    error instanceof AppError &&
    error.kind === "http" &&
    error.status === 503 &&
    error.code === "CONNECTION_POLICY_UNAVAILABLE"
  );
}

export function isRejectedCommand(error: unknown): error is AppError {
  return (
    error instanceof AppError &&
    error.kind === "http" &&
    (error.status < 500 || isConnectionPolicyUnavailable(error))
  );
}

export class CommandIntent {
  private intent?: { fingerprint: string; id: string };
  begin(fingerprint: string, createId: () => string) {
    if (this.intent && this.intent.fingerprint !== fingerprint)
      throw new AppError("http", 409, "COMMAND_RECONCILE_REQUIRED");
    this.intent ??= { fingerprint, id: createId() };
    return this.intent.id;
  }
  clear() {
    this.intent = undefined;
  }
  failed(error: unknown) {
    // The policy 503 rejects inside the transaction before a proposal is written.
    // Other 5xx, transport and protocol failures can have an unknown outcome.
    if (isRejectedCommand(error)) this.clear();
  }
}
