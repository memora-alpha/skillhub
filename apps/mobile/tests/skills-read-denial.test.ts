import assert from "node:assert/strict";
import test from "node:test";
import { ids } from "./skills-fixtures";
import { readHarness } from "./skills-read-harness";
import { AppError } from "../src/lib/http/errors";
import { ownSkill } from "./skills-fixtures";

for (const [name, args, suffix, infinite] of [
  ["useOwnSkill", [ids.sharing], ["detail", ids.sharing], false],
  ["useOwnSkills", [], ["own", false, "ALL"], true],
  ["useVerificationHistory", [ids.sharing], ["history", ids.sharing], true],
  [
    "useVerification",
    [ids.sharing, ids.verification],
    ["verification", ids.sharing, ids.verification],
    false,
  ],
] as const) {
  for (const denial of [403, 404])
    test(`${name}: 200 -> ${denial} -> 503 -> 200 hides private data until a fresh read`, async () => {
      const h = readHarness();
      const key = [...h.runtime.scope, ...suffix];
      const render = () =>
        h.hooks[name]!(...args) as {
          data?: unknown;
          readDenied?: unknown;
        };
      try {
        render();
        await h.fetch(key, infinite);
        assert.ok(render().data);
        h.status(denial);
        await assert.rejects(h.fetch(key, infinite));
        assert.equal(render().data, undefined);
        h.status(503);
        await assert.rejects(h.fetch(key, infinite));
        assert.equal(render().data, undefined);
        assert.ok(render().readDenied);
        h.status(200);
        await h.fetch(key, infinite);
        assert.ok(render().data);
        assert.equal(render().readDenied, undefined);
      } finally {
        h.client.clear();
      }
    });
}

test("a transient GET failure alone preserves owner data; mutation 403 does not revoke read access", async () => {
  const h = readHarness();
  const key = [...h.runtime.scope, "detail", ids.sharing];
  const render = () =>
    h.hooks.useOwnSkill!(ids.sharing) as {
      data?: unknown;
      readDenied?: unknown;
    };
  try {
    render();
    await h.fetch(key);
    h.status(503);
    await assert.rejects(h.fetch(key));
    assert.ok(render().data);
    assert.equal(render().readDenied, undefined);
    h.status(403);
    await assert.rejects(
      h.runtime.api.update(
        ids.sharing,
        { expectedVersion: 1, isVisible: true },
        "fixture-key",
      ),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );
    assert.ok(render().data);
    assert.equal(render().readDenied, undefined);
    h.endSession();
    assert.equal(render().data, undefined);
  } finally {
    h.client.clear();
  }
});

test("manual editor refetch enforces denial and reports the read failure", async () => {
  const h = readHarness();
  const render = () =>
    h.hooks.useOwnSkill!(ids.sharing) as {
      data?: unknown;
      refetch: (options: {
        throwOnError: boolean;
      }) => Promise<{ data?: unknown }>;
    };
  try {
    assert.ok((await render().refetch({ throwOnError: true })).data);
    h.status(403);
    await assert.rejects(render().refetch({ throwOnError: true }));
    assert.equal(render().data, undefined);
    h.status(503);
    await assert.rejects(render().refetch({ throwOnError: true }));
    assert.equal(render().data, undefined);
    h.status(200);
    assert.ok((await render().refetch({ throwOnError: true })).data);
  } finally {
    h.client.clear();
  }
});

for (const user of [ids.user, ids.other]) {
  for (const status of [403, 404])
    test(`public skills ${user}: ${status} evicts all pages and stays hidden through 503`, async () => {
      const h = readHarness();
      const key = [...h.runtime.scope, "public", user];
      const render = () =>
        h.hooks.usePublicSkills!(user) as {
          data?: unknown;
          readDenied?: unknown;
          fetchNextPage: (options: {
            throwOnError: boolean;
          }) => Promise<unknown>;
        };
      const read = h.runtime.api.publicSkills;
      h.runtime.api.publicSkills = async (target, cursor, signal) => {
        if (cursor) throw new AppError("http", status);
        const page = await read(target, cursor, signal);
        return {
          ...page,
          pagination: { limit: 20, hasMore: true, nextCursor: "next" },
        };
      };
      try {
        render();
        await h.fetch(key, true);
        await assert.rejects(render().fetchNextPage({ throwOnError: true }));
        assert.equal(render().data, undefined);
        assert.ok(render().readDenied);
        h.status(503);
        await assert.rejects(h.fetch(key, true));
        assert.equal(render().data, undefined);
        h.status(200);
        await h.fetch(key, true);
        assert.ok(render().data);
      } finally {
        h.client.clear();
      }
    });
}

test("public detail denial cannot reappear after a transient error or cache write", async () => {
  const h = readHarness();
  const key = [...h.runtime.scope, "public-detail", ids.other, ids.sharing];
  const render = () =>
    h.hooks.usePublicSkill!(ids.other, ids.sharing) as { data?: unknown };
  try {
    render();
    await h.fetch(key);
    assert.ok(render().data);
    h.status(403);
    await assert.rejects(h.fetch(key));
    h.status(503);
    await assert.rejects(h.fetch(key));
    h.client.setQueryData(key, ownSkill);
    assert.equal(render().data, undefined);
  } finally {
    h.client.clear();
  }
});
