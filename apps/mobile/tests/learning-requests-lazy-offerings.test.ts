import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { createRequestsApi } from "../src/features/learning-requests/api/requests-api";
import type {
  OwnOffering,
  Page,
} from "../src/features/learning-requests/types";
import { fixtureId, fixtureSkills } from "./fixtures/learning-requests-data";

test("offerings wait for opening the picker, retain selected labels and pass AbortSignal", async () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/hooks/use-offering-picker.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-offering-picker.ts");
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: 30000 } },
  });
  const calls: string[] = [];
  let signal: AbortSignal | undefined,
    expanded = false;
  const offering: OwnOffering = {
    id: fixtureId(900),
    skill: fixtureSkills[0],
    level: "INTERMEDIATE",
    verificationStatus: "VERIFIED",
    isVisible: true,
    archivedAt: null,
  };
  const api = createRequestsApi({
    bindSession() {},
    request: async (path, options) => {
      calls.push(path);
      signal = options?.signal;
      return {
        data: [offering],
        meta: { pagination: { limit: 20, hasMore: false, nextCursor: null } },
      };
    },
  });
  let observer: InfiniteQueryObserver<Page<OwnOffering>> | undefined;
  let stop = () => {};
  const mocks = {
    react: {
      useState: (initial: unknown) => [
        typeof initial === "boolean" ? expanded : initial,
        (value: boolean) => {
          expanded = value;
        },
      ],
      useEffect() {},
    },
    "@tanstack/react-query": {
      useInfiniteQuery: (
        options: ConstructorParameters<
          typeof InfiniteQueryObserver<Page<OwnOffering>>
        >[1],
      ) => {
        if (!observer) {
          observer = new InfiniteQueryObserver(cache, options);
          stop = observer.subscribe(() => {});
        } else observer.setOptions(options);
        return observer.getCurrentResult();
      },
    },
    "../context": {
      useRequestsRuntime: () => ({
        api,
        key: ["lr", "owner", 1],
        enabled: true,
      }),
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useOfferingPicker } = local(
      filename,
    ) as typeof import("../src/features/learning-requests/hooks/use-offering-picker");
    const closed = useOfferingPicker([], false);
    assert.equal(closed.expanded, false);
    assert.deepEqual(
      calls,
      [],
      "collapsed empty optional section must not load own skills",
    );
    closed.setExpanded(true);
    useOfferingPicker([], false);
    await observer!.refetch({ cancelRefetch: false });
    assert.deepEqual(calls, ["/me/skills?limit=20"]);
    assert.ok(signal instanceof AbortSignal);
    expanded = false;
    const selected = useOfferingPicker([offering.id], false);
    assert.equal(
      selected.selectionLabels[0]?.label.includes(offering.skill.name),
      true,
    );
    assert.equal(
      calls.length,
      1,
      "reopening or retaining a selection reuses fresh catalog data",
    );
    cache.clear();
    observer = undefined;
    stop();
    useOfferingPicker([offering.id], true);
    await observer!.refetch({ cancelRefetch: false });
    assert.equal(
      calls.length,
      2,
      "readonly selections can still resolve their labels",
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((c) => c.restore());
    stop();
    cache.clear();
  }
});
