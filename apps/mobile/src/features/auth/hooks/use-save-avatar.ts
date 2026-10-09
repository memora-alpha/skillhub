import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OwnIdentity } from "@/features/account";
import { AppError } from "@/lib/http/errors";
import { useAuthSession } from "../context/AuthSession";

export function useSaveAvatar() {
  const { runtime, account, trackAvatar } = useAuthSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: FormData | null) => {
      const generation = runtime.controller.generation;
      const userId = account?.userId;
      if (!userId) throw new AppError("session");
      const upload = body
        ? await runtime.accountApi.uploadAvatar(body)
        : (await runtime.accountApi.removeAvatar(), null);
      if (generation !== runtime.controller.generation)
        throw new AppError("session");
      trackAvatar(
        upload ? { ...upload, generation, startedAt: Date.now() } : null,
      );
      if (!upload) {
        client.setQueryData<OwnIdentity>(
          ["account", "me", generation],
          (current) =>
            current?.userId === userId
              ? { ...current, profile: { ...current.profile, avatarUrl: null } }
              : current,
        );
        void client.invalidateQueries({
          queryKey: ["account", "me", generation],
        });
      }
      return upload;
    },
  });
}
