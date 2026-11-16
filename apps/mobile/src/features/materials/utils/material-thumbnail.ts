import type { ApiMaterial } from "../api/material-contracts";

export function materialThumbnailUrl(
  material: ApiMaterial,
  large = false,
  now = Date.now(),
) {
  const thumbnail = material.cover?.preview ?? material.thumbnail;
  if (thumbnail?.kind !== "GENERATED" || Date.parse(thumbnail.expiresAt) <= now)
    return undefined;
  return large ? thumbnail.largeUrl : thumbnail.smallUrl;
}
