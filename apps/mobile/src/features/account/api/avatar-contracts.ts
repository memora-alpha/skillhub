import { AppError } from "@/lib/http/errors";
import { isRecord } from "@/lib/http/response";

export type AvatarUpload = {
  assetId: string;
  status: "QUARANTINED" | "CLEAN" | "REJECTED" | "DELETED";
};

export function parseAvatarUpload(value: unknown): AvatarUpload {
  if (
    !isRecord(value) ||
    typeof value.assetId !== "string" ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      value.assetId,
    ) ||
    !["QUARANTINED", "CLEAN", "REJECTED", "DELETED"].includes(
      String(value.status),
    )
  )
    throw new AppError("protocol");
  return { assetId: value.assetId, status: value.status } as AvatarUpload;
}
