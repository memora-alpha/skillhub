import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import {
  uploadNeedsCheck,
  UploadScanPending,
  UPLOAD_SCAN_PENDING_MESSAGE,
} from "../src/lib/http/watch-upload-status";

test("file monitor reports read failures and timeouts to its chat tile, clears errors on restart and ignores an expired owner", async () => {
  const local = createRequire(
    new URL("../src/components/automatic-file-status.tsx", import.meta.url),
  );
  const filename = local.resolve("./automatic-file-status.tsx");
  let effects: (() => void | (() => void))[] = [];
  let current = true;
  let expire = false;
  let cause: unknown = new AppError("http", 500);
  const callbacks: (string | undefined)[] = [];
  const stubs = {
    react: {
      useRef: (value: unknown) => ({ current: value }),
      useState: (value: unknown) => [value, () => {}],
      useEffect: (effect: () => void | (() => void)) => {
        effects.push(effect);
      },
    },
    "react-native": {
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove() {} }),
      },
    },
    "expo-router": { useIsFocused: () => true },
    "./Button": { Button: "Button" },
    "./FormNotice": { FormNotice: "Notice" },
    "@/lib/http/watch-upload-status": {
      uploadNeedsCheck,
      UploadScanPending,
      UPLOAD_SCAN_PENDING_MESSAGE,
      UPLOAD_SCAN_TIMEOUT_MS: 240_000,
      watchUploadStatus: async () => {
        if (expire) current = false;
        throw cause;
      },
    },
  };
  const mocks = Object.entries(stubs).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { AutomaticFileStatus } = local(
      filename,
    ) as typeof import("../src/components/automatic-file-status");
    for (const state of ["failure", "timeout", "expired"]) {
      current = true;
      expire = state === "expired";
      cause =
        state === "timeout"
          ? new UploadScanPending()
          : new AppError("http", 500);
      effects = [];
      callbacks.length = 0;
      AutomaticFileStatus({
        files: [{ fileId: "file", name: "photo.png", state: "SCANNING" }],
        onChange() {},
        status: async () => ({ fileId: "file", state: "READY" }),
        isCurrent: () => current,
        enabled: true,
        onError: (message) => {
          callbacks.push(message);
        },
      });
      const cleanup = effects.map((effect) => effect());
      try {
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.deepEqual(
          callbacks,
          state === "expired"
            ? [undefined]
            : [
                undefined,
                state === "timeout"
                  ? UPLOAD_SCAN_PENDING_MESSAGE
                  : "Máy chủ chưa xử lý được tệp. Vui lòng thử lại sau.",
              ],
        );
      } finally {
        cleanup.forEach((stop) => stop?.());
      }
    }
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((context) => context.restore());
  }
});

test("file monitor resumes when a READY file is quarantined again without resetting on scan progress", async () => {
  const local = createRequire(
    new URL("../src/components/automatic-file-status.tsx", import.meta.url),
  );
  const filename = local.resolve("./automatic-file-status.tsx");
  const slots: unknown[] = [];
  const effects: { dependencies: readonly unknown[]; cleanup?: () => void }[] =
    [];
  let cursor = 0;
  let pendingEffects: (() => void)[] = [];
  let starts = 0;
  const callbacks: (string | undefined)[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const stubs = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: {
      useRef: (value: unknown) => {
        const index = cursor++;
        return (slots[index] ??= { current: value });
      },
      useState: (value: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = value;
        return [
          slots[index],
          (next: unknown) => {
            slots[index] = next;
          },
        ];
      },
      useEffect: (
        effect: () => void | (() => void),
        dependencies: readonly unknown[],
      ) => {
        const index = cursor++;
        const previous = effects[index];
        if (
          previous &&
          dependencies.every((value, i) =>
            Object.is(value, previous.dependencies[i]),
          )
        )
          return;
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effects[index] = { dependencies, cleanup: effect() || undefined };
        });
      },
    },
    "react-native": {
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove() {} }),
      },
    },
    "expo-router": { useIsFocused: () => true },
    "./Button": { Button: "Button" },
    "./FormNotice": { FormNotice: "Notice" },
    "@/lib/http/watch-upload-status": {
      uploadNeedsCheck,
      UploadScanPending,
      UPLOAD_SCAN_PENDING_MESSAGE,
      UPLOAD_SCAN_TIMEOUT_MS: 240_000,
      watchUploadStatus: async ({
        files,
      }: {
        files: () => { state: string }[];
      }) => {
        if (files().some((file) => uploadNeedsCheck(file.state))) {
          starts++;
          throw new AppError("http", 500);
        }
      },
    },
  };
  const mocks = Object.entries(stubs).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { AutomaticFileStatus } = local(
      filename,
    ) as typeof import("../src/components/automatic-file-status");
    const render = async (state: string) => {
      cursor = 0;
      pendingEffects = [];
      AutomaticFileStatus({
        files: [{ fileId: "same-file", name: "photo.png", state }],
        onChange() {},
        status: async () => ({ fileId: "same-file", state: "READY" }),
        isCurrent: () => true,
        enabled: true,
        onError: (message) => {
          callbacks.push(message);
        },
      });
      pendingEffects.forEach((effect) => effect());
      await new Promise<void>((resolve) => setImmediate(resolve));
    };
    await render("READY");
    assert.equal(starts, 0);
    await render("QUARANTINED");
    assert.equal(
      starts,
      1,
      "the same file must be monitored after server recheck",
    );
    const afterFailure = [...callbacks];
    assert.ok(afterFailure.at(-1));
    await render("SCANNING");
    assert.equal(
      starts,
      1,
      "scan progress must not restart the timeout or retry budget",
    );
    assert.deepEqual(callbacks, afterFailure);
    await render("READY");
    assert.equal(
      callbacks.at(-1),
      undefined,
      "a fresh terminal status clears the stale warning",
    );
    await render("QUARANTINED");
    assert.equal(starts, 2);
  } finally {
    effects.forEach((effect) => effect?.cleanup?.());
    delete local.cache[filename];
    mocks.reverse().forEach((context) => context.restore());
  }
});
