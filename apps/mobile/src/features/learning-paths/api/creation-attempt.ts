import { AppError } from "@/lib/http/errors";

// Creating a path has no server idempotency. Keep uncertain attempts across navigation.
const attempts = new Map<string, "pending" | "unknown" | "done">();
export async function createPathOnce<T>(key: string, send: () => Promise<T>) {
  if (attempts.has(key))
    throw new AppError("config", 0, "PATH_CREATE_RECONCILE_REQUIRED");
  attempts.set(key, "pending");
  try {
    const result = await send();
    attempts.set(key, "done");
    return result;
  } catch (error) {
    if (
      error instanceof AppError &&
      error.kind === "http" &&
      error.status < 500
    )
      attempts.delete(key);
    else attempts.set(key, "unknown");
    throw error;
  }
}
