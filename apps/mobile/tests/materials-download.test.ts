import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { materialOwnerId } from "./fixtures/materials-data";
import { materialDownloadName } from "../src/features/materials/utils/material-download-name";

test("download is explicit, confirms purchased consumption, blocks duplicates, cancels before issue and ignores old sessions", async () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/hooks/use-material-download.ts",
      import.meta.url,
    ),
  );
  const file = local.resolve("./use-material-download.ts");
  let states: unknown[] = [],
    refs: { current: unknown }[] = [],
    stateIndex = 0,
    refIndex = 0,
    mounted = false;
  let cleanup: (() => void) | undefined;
  let current = true,
    cancelled = false,
    reads = 0,
    saves = 0,
    picks = 0;
  let releasePick: (() => void) | undefined,
    waitPick = false;
  let releaseRead: (() => void) | undefined,
    waitRead = false;
  let lastSignal: AbortSignal | undefined;
  const contexts = Object.entries({
    react: {
      useState: (initial: unknown) => {
        const n = stateIndex++;
        if (!(n in states)) states[n] = initial;
        return [
          states[n],
          (next: unknown) => {
            states[n] = next;
          },
        ];
      },
      useRef: (initial: unknown) => {
        const n = refIndex++;
        return (refs[n] ??= { current: initial });
      },
      useEffect: (effect: () => () => void) => {
        if (!mounted) {
          mounted = true;
          cleanup = effect();
        }
      },
    },
    "@/features/connections": {
      useConnections: () => ({ isCurrent: () => current }),
    },
    "./use-materials": {
      useMaterialsApi: () => ({
        download: async (_id: string, signal: AbortSignal) => {
          reads++;
          lastSignal = signal;
          if (waitRead)
            await new Promise<void>((resolve) => {
              releaseRead = resolve;
            });
          return { url: "https://files.example.test/signed" };
        },
      }),
    },
    "../utils/save-material-file": {
      prepareMaterialDownload: async () => {
        picks++;
        if (waitPick)
          await new Promise<void>((resolve) => {
            releasePick = resolve;
          });
        return cancelled
          ? undefined
          : async (_url: string, signal: AbortSignal) => {
              signal.throwIfAborted();
              saves++;
            };
      },
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[file];
    const { useMaterialDownload } = local(file);
    let issued = 0;
    const render = (id = materialOwnerId) => {
      stateIndex = 0;
      refIndex = 0;
      return useMaterialDownload(id, () => {
        issued++;
      }) as {
        start: (purchased: boolean) => Promise<void>;
        confirm: () => Promise<void>;
        cancel: () => void;
        complete: boolean;
        awaitingConfirmation: boolean;
        error: unknown;
      };
    };
    const reset = () => {
      cleanup?.();
      states = [];
      refs = [];
      mounted = false;
      current = true;
      cancelled = false;
      waitPick = false;
      waitRead = false;
    };
    let hook = render();
    assert.equal(reads, 0);
    assert.equal(issued, 0);
    cancelled = true;
    await hook.start(true);
    assert.equal(
      reads,
      0,
      "cancelled destination selection cannot consume entitlement",
    );
    cancelled = false;
    await hook.start(true);
    hook = render();
    assert.equal(hook.awaitingConfirmation, true);
    assert.equal(reads, 0);
    hook.cancel();
    hook = render();
    assert.equal(hook.awaitingConfirmation, false);
    assert.equal(reads, 0);
    await hook.start(true);
    hook = render();
    waitRead = true;
    const paid = hook.confirm();
    await hook.confirm();
    assert.equal(reads, 1);
    releaseRead?.();
    await paid;
    hook = render();
    assert.equal(hook.complete, true);
    assert.equal(saves, 1);
    assert.equal(
      issued,
      1,
      "eligibility refresh follows server-issued access, never merely opening a picker",
    );
    reset();
    hook = render();
    waitPick = true;
    const first = hook.start(false),
      priorPicks = picks;
    await hook.start(false);
    assert.equal(picks, priorPicks);
    releasePick?.();
    await first;
    assert.equal(reads, 2);
    assert.equal(saves, 2);
    reset();
    hook = render();
    waitRead = true;
    const old = hook.start(false);
    await new Promise((resolve) => setImmediate(resolve));
    current = false;
    cleanup?.();
    assert.equal(lastSignal?.aborted, true);
    releaseRead?.();
    await old;
    assert.equal(saves, 2, "no file save after logout/unmount");
    assert.equal(issued, 2, "an old session cannot refresh review eligibility");
    reset();
    hook = render("invalid-id");
    const prior = picks;
    await hook.start(false);
    assert.equal(picks, prior);
  } finally {
    cleanup?.();
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});

test("download filenames remove directory traversal separators and control characters without inventing a snapshot format", () => {
  assert.equal(
    materialDownloadName("../tài liệu\u0000.pdf"),
    ".._tài liệu.pdf",
  );
  assert.equal(materialDownloadName(" \u0001 "), "tai-lieu");
  assert.ok(materialDownloadName("a".repeat(500)).length <= 160);
});
