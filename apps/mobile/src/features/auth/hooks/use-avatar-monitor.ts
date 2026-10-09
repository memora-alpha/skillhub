import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AvatarUpload, createAccountApi } from "@/features/account";

export type TrackedAvatarUpload = AvatarUpload & {
  generation: number;
  startedAt: number;
};

export function useAvatarMonitor(
  api: ReturnType<typeof createAccountApi>,
  generation: number,
  active: boolean,
  tracked: TrackedAvatarUpload | null,
  refreshAccount: () => Promise<{ isError: boolean; error: unknown }>,
) {
  const upload = active && tracked?.generation === generation ? tracked : null;
  const [refresh, setRefresh] = useState<{
    assetId: string;
    generation: number;
    pending: boolean;
    error: unknown;
  } | null>(null);
  const query = useQuery({
    queryKey: ["account", "avatar", generation, upload?.assetId],
    queryFn: () => api.getAvatarUpload(upload!.assetId),
    enabled: !!upload,
    refetchInterval: (query) =>
      upload &&
      !query.state.error &&
      (query.state.data?.status ?? upload.status) === "QUARANTINED" &&
      Date.now() - upload.startedAt < 120_000
        ? 2000
        : false,
  });
  const refreshProfile = useCallback(async () => {
    if (!upload) return;
    const stamp = { assetId: upload.assetId, generation };
    setRefresh({ ...stamp, pending: true, error: null });
    try {
      const result = await refreshAccount();
      setRefresh({
        ...stamp,
        pending: false,
        error: result.isError ? result.error : null,
      });
    } catch (error) {
      setRefresh({ ...stamp, pending: false, error });
    }
  }, [upload, generation, refreshAccount]);
  useEffect(() => {
    if (
      upload &&
      (query.data?.status === "CLEAN" || query.data?.status === "DELETED")
    )
      void refreshProfile();
  }, [upload, query.data?.status, refreshProfile]);
  const currentRefresh =
    refresh?.generation === generation && refresh.assetId === upload?.assetId
      ? refresh
      : null;
  return {
    upload: upload ? (query.data ?? upload) : null,
    error: upload ? (query.error ?? currentRefresh?.error) : null,
    checking: !!upload && (query.isFetching || !!currentRefresh?.pending),
    waitingTooLong: !!upload && Date.now() - upload.startedAt >= 120_000,
    retry:
      query.data?.status === "CLEAN" || query.data?.status === "DELETED"
        ? refreshProfile
        : query.refetch,
  };
}
