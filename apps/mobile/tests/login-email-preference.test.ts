import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setImmediate as nextTurn } from "node:timers/promises";
import { createLoginEmailPreference } from "../src/features/auth/utils/login-email-preference";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

test("normalizes the persisted email and ignores malformed stored values", async () => {
  for (const [stored, expected] of [
    [" A@EXAMPLE.COM ", "a@example.com"],
    ["bad-email", ""],
    [null, ""],
  ] as const) {
    const preference = createLoginEmailPreference({
      read: async () => stored,
      write: async () => {},
    });
    assert.equal(await preference.load(), expected);
  }
});

test("only the latest valid email is restored by a new preference instance", async () => {
  let stored: string | null = null;
  const started = deferred<void>();
  const release = deferred<void>();
  const written = deferred<void>();
  const storage = {
    read: async () => stored,
    write: async (email: string) => {
      if (email === "first@example.com") {
        started.resolve();
        await release.promise;
      }
      stored = email;
      if (email === "last@example.com") written.resolve();
    },
  };
  const preference = createLoginEmailPreference(storage);
  preference.remember("FIRST@example.com");
  await started.promise;
  preference.remember(" LAST@EXAMPLE.COM ");
  preference.remember("invalid");
  release.resolve();
  await written.promise;
  assert.equal(
    await createLoginEmailPreference(storage).load(),
    "last@example.com",
  );
});

test("a stored read cannot replace an email entered before or during hydration", async () => {
  const result = deferred<string>();
  const preference = createLoginEmailPreference({
    read: () => result.promise,
    write: async () => {},
  });
  const loading = preference.load();
  preference.remember("new@example.com");
  result.resolve("old@example.com");
  assert.equal(await loading, "new@example.com");
  const early = createLoginEmailPreference({
    read: async () => "old@example.com",
    write: async () => {},
  });
  early.remember("new@example.com");
  assert.equal(await early.load(), "new@example.com");
});

test("optional preference storage failures do not reject login or the in-memory email", async () => {
  const written = deferred<void>();
  const preference = createLoginEmailPreference({
    read: async () => {
      throw new Error("storage unavailable");
    },
    write: async () => {
      written.resolve();
      throw new Error("storage unavailable");
    },
  });
  assert.equal(await preference.load(), "");
  assert.doesNotThrow(() => preference.remember("new@example.com"));
  await written.promise;
  assert.equal(await preference.load(), "new@example.com");
});

test("a failed initial email read can be retried after preference storage recovers", async () => {
  let reads = 0;
  const preference = createLoginEmailPreference({
    read: async () => {
      if (++reads === 1) throw new Error("temporarily unavailable");
      return "saved@example.com";
    },
    write: async () => {},
  });
  assert.equal(await preference.load(), "");
  assert.equal(await preference.load(), "saved@example.com");
  assert.equal(reads, 2);
});

test("repeating the same email retries failed writes and persists it after storage recovers", async () => {
  let stored = "old@example.com";
  let calls = 0;
  const storage = {
    read: async () => stored,
    write: async (value: string) => {
      if (++calls <= 2) throw new Error("temporary preference storage failure");
      stored = value;
    },
  };
  const preference = createLoginEmailPreference(storage);
  for (let attempt = 0; attempt < 3; attempt++) {
    preference.remember("new@example.com");
    await nextTurn();
  }
  assert.equal(calls, 3);
  assert.equal(
    await createLoginEmailPreference(storage).load(),
    "new@example.com",
  );
  preference.remember("new@example.com");
  await nextTurn();
  assert.equal(calls, 3);
});

test("a failed older write cannot clear the pending latest write or cause duplicate writes", async () => {
  const firstStarted = deferred<void>();
  const firstRelease = deferred<void>();
  const lastStarted = deferred<void>();
  const lastRelease = deferred<void>();
  const calls: string[] = [];
  let stored: string | null = null;
  const storage = {
    read: async () => stored,
    write: async (value: string) => {
      calls.push(value);
      if (value === "first@example.com") {
        firstStarted.resolve();
        await firstRelease.promise;
        throw new Error("old write failed");
      }
      lastStarted.resolve();
      await lastRelease.promise;
      stored = value;
    },
  };
  const preference = createLoginEmailPreference(storage);
  preference.remember("first@example.com");
  await firstStarted.promise;
  preference.remember("last@example.com");
  firstRelease.resolve();
  await lastStarted.promise;
  preference.remember("last@example.com");
  lastRelease.resolve();
  await nextTurn();
  preference.remember("last@example.com");
  await nextTurn();
  assert.deepEqual(calls, ["first@example.com", "last@example.com"]);
  assert.equal(
    await createLoginEmailPreference(storage).load(),
    "last@example.com",
  );
});

function emailHook(
  preference: ReturnType<typeof createLoginEmailPreference>,
  routeEmail?: string,
) {
  const file = new URL(
    "../src/features/auth/hooks/use-remembered-login-email.ts",
    import.meta.url,
  );
  const local = createRequire(file);
  const filename = fileURLToPath(file);
  let cleanup = () => {};
  let value = routeEmail ?? "";
  const contexts = [
    mock.module(pathToFileURL(local.resolve("react")), {
      namedExports: {
        useRef: () => ({ current: false }),
        useEffect: (effect: () => () => void) => {
          cleanup = effect();
        },
      },
    }),
    mock.module(pathToFileURL(local.resolve("../utils/last-login-email")), {
      namedExports: { lastLoginEmail: preference },
    }),
  ];
  try {
    delete local.cache[filename];
    const { useRememberedLoginEmail } = local(filename) as {
      useRememberedLoginEmail: (
        form: {
          getValues: () => string;
          setValue: (name: string, value: string) => void;
        },
        email?: string,
      ) => (email: string) => void;
    };
    const change = useRememberedLoginEmail(
      {
        getValues: () => value,
        setValue: (_name, next) => {
          value = next;
        },
      },
      routeEmail,
    );
    return {
      change,
      get value() {
        return value;
      },
      unmount: () => cleanup(),
      type: (next: string) => {
        value = next;
        change(next);
      },
    };
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
}

test("autofills the saved email but keeps a verification/reset route email", async () => {
  const preference = createLoginEmailPreference({
    read: async () => "saved@example.com",
    write: async () => {},
  });
  const empty = emailHook(preference);
  const route = emailHook(preference, "verified@example.com");
  await preference.load();
  assert.equal(empty.value, "saved@example.com");
  assert.equal(route.value, "verified@example.com");
  empty.unmount();
  route.unmount();
});

test("a delayed saved email cannot overwrite editing, a cleared field or an unmounted form", async () => {
  const saved = deferred<string>();
  const preference = createLoginEmailPreference({
    read: () => saved.promise,
    write: async () => {},
  });
  const editing = emailHook(preference);
  const cleared = emailHook(preference);
  const unmounted = emailHook(preference);
  editing.type("typing");
  cleared.type("");
  unmounted.unmount();
  saved.resolve("saved@example.com");
  await preference.load();
  assert.equal(editing.value, "typing");
  assert.equal(cleared.value, "");
  assert.equal(unmounted.value, "");
  editing.unmount();
  cleared.unmount();
});
