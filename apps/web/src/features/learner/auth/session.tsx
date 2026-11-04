"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Identity, Reply } from "../types";
import {
  userFetch,
  UserApiError,
  type UserRequestOptions,
} from "../api/client";
import { SignInRedirect } from "@/features/auth/sign-in-redirect";
import { announceSessionChange } from "@/features/auth/session-sync";
import { LearnerShell } from "../components/learner-shell";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
type Request = <T>(
  path: string,
  options?: UserRequestOptions,
) => Promise<Reply<T>>;
type Context = {
  actor: Identity;
  request: Request;
  refresh: () => void;
  logout: () => Promise<void>;
};
const SessionContext = createContext<Context | null>(null);
export function UserSessionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 30000,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <UserSessionLifecycle>{children}</UserSessionLifecycle>
    </QueryClientProvider>
  );
}
function UserSessionLifecycle({ children }: Readonly<{ children: ReactNode }>) {
  const cache = useQueryClient();
  const [actor, setActor] = useState<Identity | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string>();
  const epoch = useRef(0);
  const renewing = useRef<Promise<Identity> | null>(null);
  const refresh = useCallback(() => {
    void cache.invalidateQueries({ queryKey: ["learner", actor?.userId] });
  }, [cache, actor?.userId]);
  const renew = useCallback(() => {
    if (renewing.current) return renewing.current;
    const work = async () => {
      // Another tab may already have rotated the cookie while this tab waited.
      try {
        return (await userFetch<Identity>("session")).data;
      } catch (cause) {
        if (!(cause instanceof UserApiError) || cause.status !== 401)
          throw cause;
      }
      return (
        await userFetch<Identity>("session/refresh", {
          method: "POST",
          body: {},
        })
      ).data;
    };
    renewing.current = (
      "locks" in navigator
        ? navigator.locks.request("skillhub-session", work)
        : work()
    ).finally(() => {
      renewing.current = null;
    });
    return renewing.current;
  }, []);
  useEffect(() => {
    let active = true;
    void renew()
      .then((value) => {
        if (active) setActor(value);
      })
      .catch((cause: unknown) => {
        if (
          active &&
          (!(cause instanceof UserApiError) || cause.status !== 401)
        )
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể kiểm tra phiên.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [renew]);
  const request = useCallback<Request>(
    async <T,>(path: string, options: UserRequestOptions = {}) => {
      const ticket = epoch.current,
        owner = actor?.userId;
      const current = () => ticket === epoch.current;
      try {
        let result: Reply<T>;
        try {
          result = await userFetch<T>(path, options);
        } catch (cause) {
          if (
            !(cause instanceof UserApiError) ||
            cause.status !== 401 ||
            !current()
          )
            throw cause;
          const identity = await renew();
          if (!current() || identity.userId !== owner)
            throw new UserApiError(401, "SESSION_EXPIRED");
          if (options.method && options.method !== "GET")
            throw new UserApiError(401, "SESSION_RETRY_REQUIRED");
          result = await userFetch<T>(path, options);
        }
        if (!current()) throw new UserApiError(401, "SESSION_EXPIRED");
        return result;
      } catch (cause) {
        if (
          current() &&
          cause instanceof UserApiError &&
          cause.status === 401 &&
          cause.code !== "SESSION_RETRY_REQUIRED"
        ) {
          epoch.current++;
          setActor(null);
          cache.clear();
        }
        throw cause;
      }
    },
    [actor?.userId, renew, cache],
  );
  const logout = useCallback(async () => {
    await userFetch("session", { method: "DELETE" });
    announceSessionChange();
    epoch.current++;
    setActor(null);
    setError(undefined);
    cache.clear();
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("skillhub-user-draft:"))
        sessionStorage.removeItem(key);
  }, [cache]);
  const context = useMemo(
    () => (actor ? { actor, request, refresh, logout } : null),
    [actor, request, refresh, logout],
  );
  if (loading)
    return (
      <main className="learner-loading">
        <output>Đang mở không gian học tập…</output>
      </main>
    );
  if (!actor) return <SignInRedirect message={error} />;
  return (
    <SessionContext.Provider value={context}>
      <LearnerShell key={actor.userId}>{children}</LearnerShell>
    </SessionContext.Provider>
  );
}
export function useUserSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("UserSessionProvider is required");
  return value;
}
