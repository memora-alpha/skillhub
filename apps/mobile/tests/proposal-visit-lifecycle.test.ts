import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("proposal actions expire on blur, resource change and session change", () => {
  const local = createRequire(
    new URL(
      "../src/features/proposals/hooks/use-proposal-lifecycle.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-proposal-lifecycle");
  let ref: { current: unknown } | undefined;
  let focus: () => () => void = () => () => {},
    blur = () => {};
  const mocks = {
    react: {
      useCallback: (callback: unknown) => callback,
      useRef: (current: unknown) => (ref ??= { current }),
    },
    "expo-router": {
      useFocusEffect: (callback: () => () => void) => {
        blur();
        focus = callback;
        blur = callback();
      },
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useProposalLifecycle } = local(filename);
    let session = true;
    const capture = useProposalLifecycle("proposal-a");
    const current = capture(() => session);
    assert.equal(current(), true);
    blur();
    assert.equal(current(), false);
    blur = focus();
    assert.equal(
      current(),
      false,
      "returning must not revive an old operation",
    );
    const resumed = capture(() => session);
    assert.equal(resumed(), true);
    session = false;
    assert.equal(resumed(), false);
    session = true;
    const next = useProposalLifecycle("proposal-b");
    assert.equal(
      capture(() => true)(),
      false,
      "an old resource handler cannot start work on a new resource",
    );
    assert.equal(next(() => true)(), true);
    assert.equal(resumed(), false);
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});
