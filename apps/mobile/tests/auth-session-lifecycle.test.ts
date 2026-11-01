import assert from "node:assert/strict";
import test from "node:test";
import type { AuthApi } from "../src/features/auth/api/auth-api";
import type {
  RefreshCredential,
  TokenStore,
} from "../src/lib/storage/token-store";
import { AppError } from "../src/lib/http/errors";
import { SessionController } from "../src/features/auth/context/session-controller";
import {
  bindPasswordRecoverySession,
  createPasswordRecoveryStore,
} from "../src/features/auth/utils/password-recovery-flow";

const pair = (id: string) => ({
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
  tokenType: "Bearer" as const,
  expiresIn: 900,
  refreshExpiresAt: "2035-01-01T00:00:00.000Z",
});
const input = (email = "a@example.test") => ({
  email,
  password: "Password1!",
  rememberMe: true,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture() {
  let credential: RefreshCredential | null = null;
  let clearFailures = 0;
  let reads = 0;
  let refreshes = 0;
  const store: TokenStore = {
    read: async () => {
      reads++;
      return credential;
    },
    write: async (value) => {
      credential = value;
    },
    clear: async () => {
      if (clearFailures-- > 0) throw new AppError("storage");
      credential = null;
    },
  };
  const api = {
    login: async ({ email }: { email: string }) => pair(email),
    refresh: async () => {
      refreshes++;
      return pair("restored");
    },
    logout: async () => {
      throw new AppError("network");
    },
  } as unknown as AuthApi;
  return {
    api,
    store,
    controller: new SessionController(api, store),
    failClears: (count: number) => {
      clearFailures = count;
    },
    get credential() {
      return credential;
    },
    get reads() {
      return reads;
    },
    get refreshes() {
      return refreshes;
    },
  };
}

test("logout cleanup retry clears storage without restoring the signed-out credential", async () => {
  const f = fixture();
  await f.controller.login(input());
  f.failClears(2);
  await f.controller.signOut();
  assert.equal(f.controller.getSnapshot(), "offline");
  await f.controller.bootstrap();
  assert.equal(f.controller.getSnapshot(), "offline");
  assert.equal(await f.controller.getToken(), null);
  await f.controller.bootstrap();
  assert.equal(f.controller.getSnapshot(), "guest");
  assert.equal(f.credential, null);
  assert.equal(f.reads, 0);
  assert.equal(f.refreshes, 0);
});

test("late failed cleanup from A cannot replace the ready state or credential of B", async () => {
  const f = fixture();
  await f.controller.login(input());
  const started = deferred<void>();
  const clear = deferred<void>();
  f.store.clear = async () => {
    started.resolve();
    await clear.promise;
  };
  const logout = f.controller.signOut();
  await started.promise;
  const login = f.controller.login(input("b@example.test"));
  clear.reject(new AppError("storage"));
  await Promise.all([logout, login]);
  assert.equal(f.controller.getSnapshot(), "ready");
  assert.equal(f.credential?.refreshToken, pair("b@example.test").refreshToken);
});

test("a startup storage read failure can still restore a valid session on explicit retry", async () => {
  const f = fixture();
  await f.store.write(pair("stored"));
  const read = f.store.read;
  let fail = true;
  f.store.read = async () => {
    if (fail) {
      fail = false;
      throw new AppError("storage");
    }
    return read();
  };
  await f.controller.bootstrap();
  assert.equal(f.controller.getSnapshot(), "offline");
  await f.controller.bootstrap();
  assert.equal(f.controller.getSnapshot(), "ready");
  assert.equal(f.refreshes, 1);
});

for (const outcome of ["rejected", "accepted"] as const) {
  test(`queued logout deletion with ${outcome} login after a delayed rotated credential write`, async () => {
    const f = fixture();
    const started = deferred<void>();
    const release = deferred<void>();
    const write = f.store.write;
    f.store.write = async (value) => {
      if (
        value.refreshToken === pair("rotated-a").refreshToken &&
        !value.rotationPending
      ) {
        started.resolve();
        await release.promise;
      }
      await write(value);
    };
    f.api.refresh = async () => pair("rotated-a");
    await f.controller.login(input());
    const rotationRejected = assert.rejects(f.controller.renew(), AppError);
    await started.promise;
    const logout = f.controller.signOut();
    if (outcome === "rejected")
      f.api.login = async () => {
        throw new AppError("http", 401, "INVALID_CREDENTIALS");
      };
    const login = f.controller.login(input("b@example.test"));
    const loginResult =
      outcome === "rejected" ? assert.rejects(login, AppError) : login;
    release.resolve();
    await Promise.all([logout, rotationRejected, loginResult]);
    if (outcome === "accepted") {
      assert.equal(f.controller.getSnapshot(), "ready");
      assert.equal(
        f.credential?.refreshToken,
        pair("b@example.test").refreshToken,
      );
    } else {
      assert.equal(f.credential, null);
      const restarted = new SessionController(f.api, f.store);
      await restarted.bootstrap();
      assert.equal(restarted.getSnapshot(), "guest");
    }
  });
}

test("cleanup retry queued behind a successful new login cannot delete its stored credential or publish guest", async () => {
  const f = fixture();
  await f.controller.login(input());
  f.failClears(1);
  await f.controller.signOut();
  const started = deferred<void>();
  const release = deferred<void>();
  const write = f.store.write;
  f.store.write = async (value) => {
    if (value.refreshToken === pair("b@example.test").refreshToken) {
      started.resolve();
      await release.promise;
    }
    await write(value);
  };
  const login = f.controller.login(input("b@example.test"));
  await started.promise;
  const retry = f.controller.bootstrap();
  release.resolve();
  await Promise.all([login, retry]);
  assert.equal(f.controller.getSnapshot(), "ready");
  assert.equal(f.credential?.refreshToken, pair("b@example.test").refreshToken);
});

for (const outcome of ["success", "network", "unauthorized"] as const) {
  test(`B renews independently while A refresh ends with ${outcome}; A cannot clear B's flight`, async () => {
    const f = fixture();
    const startedA = deferred<void>();
    const startedB = deferred<void>();
    const responseA = deferred<ReturnType<typeof pair>>();
    const responseB = deferred<ReturnType<typeof pair>>();
    const tokens: string[] = [];
    f.api.refresh = async (token) => {
      tokens.push(token);
      if (token === pair("a@example.test").refreshToken) {
        startedA.resolve();
        return responseA.promise;
      }
      startedB.resolve();
      return responseB.promise;
    };
    await f.controller.login(input());
    const rotationA = f.controller.renew();
    const rejectedA = assert.rejects(rotationA, AppError);
    await startedA.promise;
    await f.controller.signOut();
    await f.controller.login(input("b@example.test"));
    const rotationB = f.controller.renew(pair("b@example.test").accessToken);
    assert.notEqual(rotationB, rotationA);
    await startedB.promise;
    if (outcome === "success") responseA.resolve(pair("late-a"));
    else
      responseA.reject(
        new AppError(outcome === "network" ? "network" : "http", 401),
      );
    await rejectedA;
    assert.equal(
      f.controller.renew(pair("b@example.test").accessToken),
      rotationB,
    );
    responseB.resolve(pair("rotated-b"));
    await rotationB;
    assert.deepEqual(tokens, [
      pair("a@example.test").refreshToken,
      pair("b@example.test").refreshToken,
    ]);
    assert.equal(f.controller.getSnapshot(), "ready");
    assert.equal(await f.controller.getToken(), pair("rotated-b").accessToken);
  });
}

const proof = () => ({
  resetToken: "a".repeat(43),
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
});
for (const transition of [
  "expire",
  "logout",
  "same-email",
  "other-email",
  "reauth",
] as const) {
  test(`signed-in recovery loses its proof on ${transition}, independently of mounted screens`, async () => {
    const f = fixture();
    const store = createPasswordRecoveryStore();
    const stop = bindPasswordRecoverySession(f.controller, store);
    try {
      await f.controller.login(input());
      store.getState().begin("a@example.test", f.controller.generation);
      store.getState().authorize("a@example.test", proof());
      if (transition === "expire") {
        const pending = f.controller.expire();
        assert.equal(store.getState().draft, null);
        await pending;
      } else if (transition === "logout") await f.controller.signOut();
      else if (transition === "reauth") {
        f.api.refresh = async () => {
          throw new AppError("network");
        };
        await assert.rejects(f.controller.renew(), AppError);
      } else {
        await f.controller.login(
          input(
            transition === "same-email" ? "a@example.test" : "b@example.test",
          ),
        );
      }
      assert.equal(store.getState().draft, null);
      assert.equal(store.getState().ownerGeneration, null);
      assert.equal(
        store.getState().authorize("a@example.test", proof()),
        false,
      );
    } finally {
      stop();
    }
  });
}

test("guest recovery remains valid through guest bootstrap and same-email login", async () => {
  const f = fixture();
  const store = createPasswordRecoveryStore();
  const stop = bindPasswordRecoverySession(f.controller, store);
  try {
    store.getState().begin("a@example.test");
    store.getState().authorize("a@example.test", proof());
    const draft = store.getState().draft;
    await f.controller.bootstrap();
    assert.equal(store.getState().draft, draft);
    await f.controller.login(input());
    assert.equal(store.getState().draft, draft);
    assert.equal(store.getState().ownerGeneration, null);
  } finally {
    stop();
  }
});
