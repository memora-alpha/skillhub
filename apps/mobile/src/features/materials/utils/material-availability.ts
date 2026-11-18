import { AppError } from "@/lib/http/errors";

export function isMaterialUnavailable(error: unknown) {
  return (
    error instanceof AppError && error.kind === "http" && error.status === 404
  );
}
