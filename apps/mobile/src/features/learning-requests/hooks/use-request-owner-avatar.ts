import { useState } from "react";
import { useParticipantProfile } from "@/features/connections";
import type { PublicRequest } from "../types";
import { requestAvatarExpired } from "../utils/request-avatar";

export function useRequestOwnerAvatar(
  owner: PublicRequest["owner"] | undefined,
  enabled = true,
) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const url = owner?.avatarUrl;
  const recover =
    enabled && !!url && (requestAvatarExpired(url) || failedUrl === url);
  const profile = useParticipantProfile(owner?.id, recover);
  let sourceUri = enabled ? url : undefined;
  if (recover) {
    const fresh = profile.data?.avatarUrl;
    sourceUri = requestAvatarExpired(fresh) ? undefined : fresh;
  }
  return {
    sourceUri,
    onImageError: () => {
      if (enabled && url && !recover) setFailedUrl(url);
    },
  };
}
