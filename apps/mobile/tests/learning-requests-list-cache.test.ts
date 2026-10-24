import assert from "node:assert/strict";
import test from "node:test";
import {
  QueryClient,
  QueryObserver,
  InfiniteQueryObserver,
} from "@tanstack/react-query";
import { requestSkillOptions } from "../src/features/learning-requests/utils/request-skill-query";
import {
  requestListOptions,
  fetchRequestNextPage,
  canAutoLoadRequestPage,
} from "../src/features/learning-requests/utils/request-list-query";
import { createRequestsApi } from "../src/features/learning-requests/api/requests-api";
import { AppError } from "../src/lib/http/errors";
import {
  fixtureSkills,
  fixtureRequest,
} from "./fixtures/learning-requests-data";

const unused = createRequestsApi({
  bindSession() {},
  request: async () => {
    throw Error("Unexpected request");
  },
});

test("skill names reuse a fresh session catalog without an extra detail request", async () => {
  const cache = new QueryClient();
  const key = ["lr", "owner", 1];
  const skill = fixtureSkills[0];
  let calls = 0;
  const api = {
    ...unused,
    skill: async () => {
      calls++;
      return skill;
    },
  };
  cache.setQueryData([...key, "skills", undefined], {
    pages: [{ items: [skill], hasMore: false, nextCursor: null }],
    pageParams: [undefined],
  });
  const observer = new QueryObserver(
    cache,
    requestSkillOptions(api, key, skill.id, cache),
  );
  const stop = observer.subscribe(() => {});
  try {
    assert.equal(observer.getCurrentResult().data?.name, skill.name);
    assert.equal(observer.getCurrentResult().isFetching, false);
    assert.equal(calls, 0);
    const other = new QueryObserver(
      cache,
      requestSkillOptions(api, ["lr", "other", 2], skill.id, cache),
    );
    const stopOther = other.subscribe(() => {});
    await other.refetch({ cancelRefetch: false });
    stopOther();
    assert.equal(calls, 1, "catalog data cannot cross account generations");
  } finally {
    stop();
    cache.clear();
  }
});

test("invalidated catalogs do not seed potentially obsolete skill names", async () => {
  const cache = new QueryClient();
  const key = ["lr", "owner", 1];
  const skill = fixtureSkills[0];
  cache.setQueryData([...key, "skills"], { pages: [{ items: [skill] }] });
  await cache.invalidateQueries({
    queryKey: [...key, "skills"],
    refetchType: "none",
  });
  let calls = 0;
  const observer = new QueryObserver(
    cache,
    requestSkillOptions(
      {
        ...unused,
        skill: async () => {
          calls++;
          return { ...skill, name: "Updated" };
        },
      },
      key,
      skill.id,
      cache,
    ),
  );
  const stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    assert.equal(calls, 1);
    assert.equal(observer.getCurrentResult().data?.name, "Updated");
  } finally {
    stop();
    cache.clear();
  }
});

test("rapid end-reached callbacks share a page read and stop automatically after a failure", async () => {
  const cache = new QueryClient();
  let calls = 0;
  let release!: () => void;
  let failed = true;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const options = requestListOptions(
    {
      ...unused,
      list: async (_scope, _filters, cursor) => {
        calls++;
        if (cursor) {
          await wait;
          if (failed) throw new AppError("http", 429);
        }
        return {
          items: [fixtureRequest()],
          hasMore: !cursor,
          nextCursor: cursor ? null : "next",
        };
      },
    },
    ["lr", "owner", 1],
    "mine",
    {},
  );
  const observer = new InfiniteQueryObserver(cache, options);
  const stop = observer.subscribe(() => {});
  const auto = () => {
    const result = observer.getCurrentResult();
    if (
      canAutoLoadRequestPage({
        active: true,
        hasNextPage: result.hasNextPage,
        fetching: result.isFetching,
        error: result.error,
        count: result.data?.pages[0]?.items.length ?? 0,
      })
    )
      return fetchRequestNextPage(cache, options.queryKey, () =>
        observer.fetchNextPage({ cancelRefetch: false }),
      );
  };
  try {
    await observer.refetch({ cancelRefetch: false });
    const loading = auto();
    await auto();
    await auto();
    assert.equal(calls, 2);
    release();
    await loading;
    await auto();
    assert.equal(calls, 2, "scroll must not immediately retry a 429");
    assert.equal(observer.getCurrentResult().data?.pages.length, 1);
    failed = false;
    await fetchRequestNextPage(cache, options.queryKey, () =>
      observer.fetchNextPage({ cancelRefetch: false }),
    );
    assert.equal(observer.getCurrentResult().data?.pages.length, 2);
    assert.equal(observer.getCurrentResult().hasNextPage, false);
  } finally {
    stop();
    cache.clear();
  }
});

test("a repeated server cursor ends pagination instead of looping on the same page", async () => {
  const cache = new QueryClient();
  const options = requestListOptions(
    {
      ...unused,
      list: async () => ({
        items: [fixtureRequest()],
        hasMore: true,
        nextCursor: "same",
      }),
    },
    ["lr", "owner", 1],
    "feed",
    {},
  );
  const observer = new InfiniteQueryObserver(cache, options);
  const stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    await observer.fetchNextPage();
    assert.equal(observer.getCurrentResult().hasNextPage, false);
    assert.equal(observer.getCurrentResult().data?.pages.length, 2);
  } finally {
    stop();
    cache.clear();
  }
});
