import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import { fixtureMaterial } from "./fixtures/materials-data";

test("editor resolves version conflicts only after fresh read and explicit choice, preserving or replacing the draft", async () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/hooks/use-material-editor.ts",
      import.meta.url,
    ),
  );
  const original = fixtureMaterial();
  let server = fixtureMaterial({
    listingVersion: 2,
    title: "Tên mới trên máy chủ",
  });
  const states: unknown[] = [],
    refs: { current: unknown }[] = [];
  let stateIndex = 0,
    refIndex = 0;
  let mounted = false,
    cleanup: (() => void) | undefined,
    current = true;
  let commandError: unknown,
    readFailure = false,
    readCount = 0;
  let resolveRead: (() => void) | undefined,
    waitRead = false,
    signal: AbortSignal | undefined;
  const sent: { version: number; body: unknown }[] = [];
  const initialValues = {
    skillId: original.skillId,
    title: "Nội dung chưa lưu",
    description: original.description,
    accessType: "FREE",
    priceCredit: "0",
    rights: true,
  };
  let values = { ...initialValues };
  const upload = {
    fileId: original.id,
    name: "replacement.docx",
    state: "READY",
  };
  const contexts = Object.entries({
    react: {
      useState: (initial: unknown) => {
        const n = stateIndex++;
        if (!(n in states)) states[n] = initial;
        return [
          states[n],
          (value: unknown) => {
            states[n] = value;
          },
        ];
      },
      useRef: (initial: unknown) => (refs[refIndex++] ??= { current: initial }),
      useEffect: (effect: () => () => void) => {
        if (!mounted) {
          mounted = true;
          cleanup = effect();
        }
      },
    },
    "react-hook-form": {
      useForm: () => ({
        handleSubmit: (send: (value: unknown) => Promise<void>) => () =>
          send(values),
        reset: (next: typeof values) => {
          values = next;
        },
      }),
    },
    "@hookform/resolvers/zod": { zodResolver() {} },
    "expo-router": { useRouter: () => ({ replace() {} }) },
    "@/features/connections": {
      useConnections: () => ({ isCurrent: () => current }),
      useConnectionCommand: () => ({
        error: commandError,
        pending: false,
        uncertain: false,
        run: async (_fingerprint: string, send: () => Promise<unknown>) => {
          try {
            commandError = undefined;
            return await send();
          } catch (error) {
            commandError = error;
          }
        },
      }),
    },
    "./use-materials": {
      useMaterialsApi: () => ({
        ownerDetail: async (id: string, requestSignal: AbortSignal) => {
          assert.equal(id, original.id);
          readCount++;
          signal = requestSignal;
          if (waitRead)
            await new Promise<void>((resolve) => {
              resolveRead = resolve;
            });
          if (readFailure) throw new AppError("network");
          return server;
        },
        update: async (_id: string, version: number, body: unknown) => {
          sent.push({ version, body });
          if (version !== server.listingVersion)
            throw new AppError("http", 409, "MATERIAL_VERSION_CONFLICT");
          return server;
        },
      }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./use-material-editor.ts");
  try {
    delete local.cache[file];
    const { useMaterialEditor } = local(file);
    const render = () => {
      stateIndex = refIndex = 0;
      return useMaterialEditor(original);
    };
    let hook = render();
    hook.setFiles([upload]);
    hook = render();
    await hook.save();
    hook = render();
    assert.equal(hook.recovery.conflict, true);
    await hook.save();
    assert.equal(sent.length, 1, "conflict cannot resubmit the stale version");
    assert.equal(readCount, 0, "recovery read requires an explicit click");
    readFailure = true;
    await hook.recovery.reload();
    hook = render();
    assert.ok(hook.recovery.error);
    assert.equal(values.title, initialValues.title);
    assert.deepEqual(hook.files, [upload]);
    readFailure = false;
    await hook.recovery.reload();
    hook = render();
    assert.equal(hook.recovery.latest.title, server.title);
    assert.equal(hook.material.listingVersion, 1);
    await hook.save();
    assert.equal(
      sent.length,
      1,
      "reading the latest version must not save or rebase automatically",
    );
    hook.resolveConflict(true);
    hook = render();
    assert.equal(hook.recovery.conflict, false);
    assert.equal(hook.recovery.handledError, true);
    assert.equal(values.title, initialValues.title);
    assert.deepEqual(hook.files, [upload]);
    await hook.save();
    assert.equal(sent.at(-1)?.version, 2);
    assert.equal(
      (sent.at(-1)?.body as { title: string }).title,
      initialValues.title,
    );

    server = { ...server, listingVersion: 3, title: "Nội dung bản thứ ba" };
    await render().save();
    hook = render();
    assert.equal(
      hook.recovery.conflict,
      true,
      "a subsequent conflict must be actionable again",
    );
    await hook.recovery.reload();
    hook = render();
    hook.resolveConflict(false);
    hook = render();
    assert.equal(values.title, server.title);
    assert.equal(
      values.rights,
      true,
      "adopting the server draft restores its recorded distribution-rights confirmation",
    );
    assert.deepEqual(hook.files, []);
    assert.equal(hook.material.listingVersion, 3);

    commandError = new AppError("http", 409, "MATERIAL_VERSION_CONFLICT");
    server = { ...server, listingVersion: 4, status: "HIDDEN" };
    hook = render();
    await hook.recovery.reload();
    hook = render();
    hook.resolveConflict(true);
    hook = render();
    assert.equal(
      hook.material.listingVersion,
      3,
      "hidden materials cannot be adopted for editing",
    );
    assert.equal(hook.blocked, true);
    server = { ...server, status: "DRAFT" };
    waitRead = true;
    const pending = hook.recovery.reload();
    current = false;
    resolveRead!();
    await pending;
    assert.equal(
      render().recovery.latest,
      undefined,
      "old-session reads cannot supply a new base",
    );
    current = true;
    hook = render();
    const unmountedRead = hook.recovery.reload();
    cleanup?.();
    assert.equal(signal?.aborted, true);
    resolveRead!();
    await unmountedRead;
    assert.equal(render().recovery.latest, undefined);
  } finally {
    cleanup?.();
    contexts.forEach((context) => context.restore());
    delete local.cache[file];
  }
});
