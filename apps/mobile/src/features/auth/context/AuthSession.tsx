import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  createAccountApi,
  type OwnIdentity,
  type ProfilePatch,
} from "@/features/account";
import { getApiUrl } from "@/config/env";
import { createHttpClient } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import { createAuthTokenStore } from "@/lib/storage/auth-token-store";
import { createAuthApi } from "../api/auth-api";
import { SessionController } from "./session-controller";
import {
  useAvatarMonitor,
  type TrackedAvatarUpload,
} from "../hooks/use-avatar-monitor";

export type AccountSession = {
  userId: string;
  name: string;
  email: string;
  isNew: boolean;
  bio: string;
  headline: string;
  avatarUrl: string | null;
  reputationScore: number | null;
  verifiedSkillCount: number;
  completedSessionCount: number;
  selectedTitle?: string | null;
};
function displayAccount(account: OwnIdentity): AccountSession {
  return {
    ...account.profile,
    name: account.profile.fullName,
    email: account.email,
    isNew: account.profile.completedSessionCount === 0,
  };
}
function createRuntime() {
  const client = createHttpClient(getApiUrl);
  const api = createAuthApi(client);
  const controller = new SessionController(api, createAuthTokenStore());
  client.bindSession(controller);
  return { api, controller, client, accountApi: createAccountApi(client) };
}
type Runtime = ReturnType<typeof createRuntime>;
type AuthContextValue = {
  session: AccountSession | null;
  account: OwnIdentity | null;
  status: "bootstrapping" | "guest" | "authenticated" | "offline" | "reauth";
  error: unknown;
  runtime: Runtime;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  retryBootstrap: () => void;
  avatar: ReturnType<typeof useAvatarMonitor>;
  trackAvatar: (upload: TrackedAvatarUpload | null) => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [runtime] = useState(createRuntime);
  const [trackedAvatar, setTrackedAvatar] =
    useState<TrackedAvatarUpload | null>(null);
  const trackAvatar = useCallback(
    (upload: TrackedAvatarUpload | null) => setTrackedAvatar(upload),
    [],
  );
  const { controller } = runtime;
  const queryClient = useQueryClient();
  const phase = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const generation = controller.generation;
  const query = useQuery({
    queryKey: ["account", "me", generation],
    queryFn: async () => {
      const account = await runtime.accountApi.getMe();
      if (account.accountStatus !== "ACTIVE") {
        await controller.expire();
        throw new AppError("session");
      }
      return account;
    },
    enabled: phase === "ready",
    // The current API signs avatar URLs for 60 seconds.
    refetchInterval: (query) =>
      query.state.data?.profile.avatarUrl ? 45_000 : false,
  });
  const avatar = useAvatarMonitor(
    runtime.accountApi,
    generation,
    phase === "ready",
    trackedAvatar,
    query.refetch,
  );
  useEffect(() => {
    void controller.bootstrap();
  }, [controller]);
  useEffect(() => {
    if (phase !== "ready") {
      void queryClient.cancelQueries({ queryKey: ["account"] });
      queryClient.removeQueries({ queryKey: ["account"] });
    }
  }, [phase, generation, queryClient]);
  const account = phase === "ready" ? (query.data ?? null) : null;
  const status =
    phase === "ready"
      ? account
        ? "authenticated"
        : query.isError
          ? "offline"
          : "bootstrapping"
      : phase;
  const value = useMemo<AuthContextValue>(
    () => ({
      session: account ? displayAccount(account) : null,
      account,
      status,
      error: query.error ?? controller.error,
      runtime,
      avatar,
      trackAvatar,
      signOut: controller.signOut,
      signOutAll: controller.signOutAll,
      retryBootstrap: () => {
        if (controller.getSnapshot() === "ready") void query.refetch();
        else void controller.bootstrap();
      },
    }),
    [
      account,
      status,
      query.error,
      query.refetch,
      runtime,
      controller,
      avatar,
      trackAvatar,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthSessionProvider is required");
  return context;
}

export function useUpdateProfile() {
  const { runtime, account } = useAuthSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const generation = runtime.controller.generation;
      const profile = await runtime.accountApi.updateProfile(patch);
      if (
        generation !== runtime.controller.generation ||
        profile.userId !== account?.userId
      )
        throw new AppError("session");
      client.setQueryData<OwnIdentity>(
        ["account", "me", generation],
        (current) => (current ? { ...current, profile } : current),
      );
      void client.invalidateQueries({
        queryKey: ["account", "me", generation],
      });
      return profile;
    },
  });
}
