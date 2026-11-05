import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { requestGroupTitle } from "../src/features/messages/utils/request-group-title";
import { fixtureId } from "./fixtures/learning-requests-data";

const requestId = fixtureId(20);
const reference = `#${requestId.slice(-8).toUpperCase()}`;
test("readable request uses its actual title rather than skill or a generic label", () => {
  assert.equal(
    requestGroupTitle(requestId, {
      title: "  Học React cơ bản  ",
      skillName: "JavaScript",
    }),
    "Học React cơ bản",
  );
});
test("private and missing requests use readable skill plus request identity and never a revoked cached title", () => {
  const fallback = requestGroupTitle(requestId, {
    title: "Old private title",
    denied: true,
    skillName: "React",
  });
  assert.equal(fallback, `React · ${reference}`);
  assert.notEqual(
    fallback,
    requestGroupTitle(fixtureId(21), { denied: true, skillName: "React" }),
  );
  assert.equal(
    requestGroupTitle(requestId, { title: "Old private title", denied: true }),
    `Yêu cầu ${reference}`,
  );
});
test("loading and failed reads remain distinguishable per request without inventing post titles", () => {
  assert.equal(
    requestGroupTitle(requestId, { pending: true }),
    `Đang tải ${reference}`,
  );
  assert.equal(requestGroupTitle(requestId, {}), `Yêu cầu ${reference}`);
  assert.notEqual(
    requestGroupTitle(requestId, {}),
    requestGroupTitle(fixtureId(21), {}),
  );
  assert.equal(
    requestGroupTitle(requestId, { title: " " }),
    `Yêu cầu ${reference}`,
  );
  assert.equal(
    requestGroupTitle(requestId, { title: "New authorized title" }),
    "New authorized title",
  );
});

test("inbox pull refresh retries active request titles for the current session without fetching lists or another user's titles", async () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/hooks/use-requests.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-requests.ts");
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const key = ["learning-requests", fixtureId(1), 1];
  let current = true;
  const reads: string[] = [];
  const stops: (() => void)[] = [];
  const observe = (queryKey: unknown[], name: string) => {
    cache.setQueryData(queryKey, name);
    const observer = new QueryObserver(cache, {
      queryKey,
      queryFn: async () => {
        reads.push(name);
        return name;
      },
    });
    stops.push(observer.subscribe(() => {}));
  };
  observe([...key, "detail", requestId], "active title");
  observe([...key, "list", "mine"], "request list");
  observe(
    ["learning-requests", fixtureId(2), 1, "detail", requestId],
    "other user",
  );
  cache.setQueryData([...key, "detail", fixtureId(21)], "inactive title");
  const mocks = {
    react: { useCallback: (fn: unknown) => fn },
    "react-native": { AppState: {} },
    "expo-router": { useFocusEffect() {} },
    "@tanstack/react-query": { useQueryClient: () => cache },
    "../context": {
      useRequestsRuntime: () => ({ key, isCurrent: () => current }),
    },
  };
  const handles = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useRefreshRequestDetails } = local(
      filename,
    ) as typeof import("../src/features/learning-requests/hooks/use-requests");
    await useRefreshRequestDetails()();
    assert.deepEqual(reads, ["active title"]);
    current = false;
    await useRefreshRequestDetails()();
    assert.deepEqual(reads, ["active title"]);
  } finally {
    stops.forEach((stop) => stop());
    cache.clear();
    delete local.cache[filename];
    handles.reverse().forEach((h) => h.restore());
  }
});
