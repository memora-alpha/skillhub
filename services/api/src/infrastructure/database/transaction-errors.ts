type DriverCause = { code?: unknown; originalCode?: unknown };
type DatabaseError = {
  code?: unknown;
  cause?: unknown;
  meta?: { driverAdapterError?: { cause?: unknown } };
};

const retryableSqlStates: ReadonlySet<unknown> = new Set(["40001", "40P01"]);

/** adapter-pg 7.8.0 always sets `originalCode`; `code` exists only for errors it does not map. */
function sqlState(cause: unknown): unknown {
  if (!cause || typeof cause !== "object") return undefined;
  const driver = cause as DriverCause;
  return driver.originalCode ?? driver.code;
}

/**
 * Serialization failure (40001) or deadlock (40P01). The driver error arrives bare as
 * `error.cause`, or wrapped by Prisma (P2034 for model queries, P2010 for raw queries)
 * under `error.meta.driverAdapterError.cause`.
 */
export function isRetryableDatabaseConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as DatabaseError;
  if (databaseError.code === "P2034") return true;
  return [
    databaseError.code,
    sqlState(databaseError.cause),
    sqlState(databaseError.meta?.driverAdapterError?.cause),
  ].some((code) => retryableSqlStates.has(code));
}
