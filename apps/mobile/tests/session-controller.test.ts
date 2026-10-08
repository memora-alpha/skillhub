import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import type { AuthApi } from "../src/features/auth/api/auth-api";
import type { TokenStore } from "../src/lib/storage/token-store";
import { SessionController } from "../src/features/auth/context/session-controller";

const pair = (suffix: string) => ({
  accessToken: `access-${suffix}`,
  refreshToken: `refresh-${suffix}`,
  tokenType: "Bearer" as const,
  expiresIn: 900,
  refreshExpiresAt: "2030-01-01T00:00:00.000Z",
});
function memoryStore(): TokenStore & { value: string | null; writes: number } {
  let credential: Awaited<ReturnType<TokenStore["read"]>> = null;
  const store = {
    value: null as string | null,
    writes: 0,
    read: async () => credential,
    write: async (value: NonNullable<typeof credential>) => {
      credential = value;
      store.value = value.refreshToken;
      store.writes += 1;
    },
    clear: async () => {
      credential = null;
      store.value = null;
    },
  };
  return store;
}
function fakeApi(refresh: (token: string) => Promise<ReturnType<typeof pair>>) {
  return {
    login: async () => pair("login"),
    refresh,
    logout: async () => undefined,
    logoutAll: async () => undefined,
  } as unknown as AuthApi;
}

test("serializes refresh calls and gives all callers the rotated access token", async () => {
  const store = memoryStore();
  let calls = 0;
  const controller = new SessionController(
    fakeApi(async () => {
      calls += 1;
      return pair("rotated");
    }),
    store,
    () => Date.parse("2029-01-01T00:00:00.000Z"),
  );
  await controller.login({
    email: "user@example.com",
    password: "Password1!",
    rememberMe: true,
  });
  await Promise.all([
    controller.renew(),
    controller.renew(),
    controller.renew(),
  ]);
  assert.equal(calls, 1);
  assert.equal(await controller.getToken(), "access-rotated");
  assert.equal(store.value, "refresh-rotated");
});

test("does not replay a refresh token after a network-ambiguous rotation", async () => {
  const store = memoryStore();
  const controller = new SessionController(
    fakeApi(async () => {
      throw new AppError("network");
    }),
    store,
    () => Date.parse("2029-01-01T00:00:00.000Z"),
  );
  await controller.login({
    email: "user@example.com",
    password: "Password1!",
    rememberMe: true,
  });
  await assert.rejects(controller.renew(), AppError);
  assert.equal(controller.getSnapshot(), "reauth");
  const restored = new SessionController(
    fakeApi(async () => pair("unexpected")),
    store,
    () => Date.parse("2029-01-01T00:00:00.000Z"),
  );
  await restored.bootstrap();
  assert.equal(restored.getSnapshot(), "reauth");
});

test("logout wins over a late login response", async () => {
  const store = memoryStore();
  let resolveLogin: ((value: ReturnType<typeof pair>) => void) | undefined;
  const api = fakeApi(async () => pair("refresh"));
  api.login = () =>
    new Promise((resolve) => {
      resolveLogin = resolve;
    });
  const controller = new SessionController(api, store, () =>
    Date.parse("2029-01-01T00:00:00.000Z"),
  );
  const pending = controller.login({
    email: "user@example.com",
    password: "Password1!",
    rememberMe: true,
  });
  await controller.signOut();
  resolveLogin?.(pair("late"));
  await assert.rejects(pending, AppError);
  assert.equal(controller.getSnapshot(), "guest");
  assert.equal(store.value, null);
});
