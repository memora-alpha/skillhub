import type { ExecutionContext } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants";

/** Controller metadata is server-owned and excludes IDs/query strings from keys and logs. */
export function requestRateScope(context: ExecutionContext): string {
  const path: unknown = Reflect.getMetadata(PATH_METADATA, context.getClass());
  if (typeof path === "string" && /^[a-zA-Z0-9/-]{1,100}$/.test(path))
    return path;
  return "other";
}
