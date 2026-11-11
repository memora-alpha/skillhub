import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";

test("legacy Path cursor resets the whole owner-scoped chain once, without replaying other errors or off-focus work", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/hooks/use-learning-paths-api.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-learning-paths-api.ts");
  const resets: unknown[] = [];
  let current = true;
  const recovered = { current: undefined as unknown };
  const query = { error: undefined as unknown, isFetchNextPageError: false };
  const key = ["connections", "actor", 7];
  const contexts = Object.entries({
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useEffect: (fn: () => void) => fn(),
      useRef: () => recovered,
    },
    "@tanstack/react-query": {
      useQueryClient: () => ({
        resetQueries: (options: unknown) => {
          resets.push(options);
          return Promise.resolve();
        },
      }),
    },
    "@/features/connections": {
      useConnections: () => ({
        key,
        userId: "actor",
        isCurrent: () => current,
      }),
      useConnectionList: () => query,
      useConnectionQuery: () => ({}),
    },
    "./use-agreement-refresh": { useAgreementRefresh: () => {} },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useLearningPathPages } = local(filename);
    query.error = new AppError("http", 400, "INVALID_LEARNING_PATH_CURSOR");
    query.isFetchNextPageError = true;
    useLearningPathPages(true);
    useLearningPathPages(true);
    assert.deepEqual(resets, [
      { queryKey: [...key, "learning-paths", "mine", "pages"], exact: true },
    ]);
    for (const error of [
      new AppError("http", 500),
      new AppError("http", 400, "OTHER"),
    ]) {
      query.error = error;
      useLearningPathPages(true);
    }
    query.error = new AppError("http", 400, "INVALID_LEARNING_PATH_CURSOR");
    useLearningPathPages(false);
    current = false;
    useLearningPathPages(true);
    current = true;
    query.isFetchNextPageError = false;
    useLearningPathPages(true);
    assert.equal(resets.length, 1);
  } finally {
    delete local.cache[filename];
    contexts.forEach((context) => context.restore());
  }
});
