import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { publicSchema } from "../src/features/learning-requests/types";
import { createRequestsApi } from "../src/features/learning-requests/api/requests-api";
import { requestAvatarExpired } from "../src/features/learning-requests/utils/request-avatar";
import {
  fixtureId,
  fixtureRequest,
  publicFixture,
} from "./fixtures/learning-requests-data";

function signed(time: number, filename = "avatar.png") {
  const date = new Date(time)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `https://images.example/${filename}?X-Amz-Date=${date}&X-Amz-Expires=60&X-Amz-Signature=test`;
}

test("feed, recommended and public detail retain the required nullable owner avatar without private fields", async () => {
  const value = publicFixture({
    actor: fixtureId(1),
    request: fixtureRequest(),
  });
  const url = signed(Date.now());
  const item = {
    ...value,
    owner: { ...value.owner, avatarUrl: url, storageKey: "private" },
  };
  const api = createRequestsApi({
    bindSession() {},
    request: async (path) =>
      path.endsWith(value.id)
        ? item
        : {
            data: [item],
            meta: {
              pagination: { hasMore: false, nextCursor: null, limit: 20 },
            },
          },
  });
  for (const scope of ["feed", "recommended"] as const) {
    const row = (await api.list(scope, {})).items[0]!;
    assert.ok("owner" in row);
    assert.equal(row.owner.avatarUrl, url);
    assert.equal("storageKey" in row.owner, false);
  }
  const detail = await api.detail(value.id);
  assert.ok("owner" in detail);
  assert.equal(detail.owner.avatarUrl, url);
  assert.equal(publicSchema.parse(value).owner.avatarUrl, null);
  for (const avatarUrl of [
    undefined,
    "file:///private.png",
    "javascript:alert(1)",
    "invalid",
  ]) {
    assert.equal(
      publicSchema.safeParse({ ...value, owner: { ...value.owner, avatarUrl } })
        .success,
      false,
    );
  }
});

test("presigned avatars expire at the server signing timestamp plus 60 seconds", () => {
  const now = Date.UTC(2026, 9, 27, 10, 0);
  const url = signed(now);
  assert.equal(requestAvatarExpired(url, now + 59_999), false);
  assert.equal(requestAvatarExpired(url, now + 60_000), true);
  assert.equal(requestAvatarExpired(url, now + 120_000), true);
  for (const value of [
    null,
    undefined,
    "invalid",
    "https://images.example/avatar.png",
    "https://images.example/?X-Amz-Date=bad&X-Amz-Expires=60",
  ]) {
    assert.equal(requestAvatarExpired(value, now), false);
  }
});

test("request avatars use the projection, never fetch for null/hidden owners, and recover failed or expired URLs through profile cache", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/hooks/use-request-owner-avatar.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-request-owner-avatar.ts");
  let failed: unknown;
  let profileUrl: string | null | undefined = signed(Date.now(), "fresh.png");
  const calls: { id?: string; enabled: boolean }[] = [];
  const mocks = {
    react: {
      useState: () => [
        failed,
        (value: unknown) => {
          failed = value;
        },
      ],
    },
    "@/features/connections": {
      useParticipantProfile: (id: string | undefined, enabled: boolean) => {
        calls.push({ id, enabled });
        return { data: { avatarUrl: profileUrl } };
      },
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useRequestOwnerAvatar } = local(
      filename,
    ) as typeof import("../src/features/learning-requests/hooks/use-request-owner-avatar");
    const owner = {
      id: fixtureId(1),
      displayName: "Linh",
      avatarUrl: signed(Date.now()),
    };
    const first = useRequestOwnerAvatar(owner);
    assert.equal(first.sourceUri, owner.avatarUrl);
    assert.equal(
      calls.at(-1)!.enabled,
      false,
      "fresh projection does not trigger another profile request",
    );
    assert.equal(
      useRequestOwnerAvatar({ ...owner, avatarUrl: null }).sourceUri,
      null,
    );
    assert.equal(
      calls.at(-1)!.enabled,
      false,
      "null is authoritative even with a cached profile avatar",
    );
    assert.equal(useRequestOwnerAvatar(owner, false).sourceUri, undefined);
    assert.equal(calls.at(-1)!.enabled, false);
    assert.equal(useRequestOwnerAvatar(undefined).sourceUri, undefined);
    assert.equal(calls.at(-1)!.enabled, false);
    first.onImageError();
    assert.equal(useRequestOwnerAvatar(owner).sourceUri, profileUrl);
    assert.equal(calls.at(-1)!.enabled, true);
    const replaced = {
      ...owner,
      avatarUrl: signed(Date.now(), "replacement.png"),
    };
    assert.equal(useRequestOwnerAvatar(replaced).sourceUri, replaced.avatarUrl);
    assert.equal(
      calls.at(-1)!.enabled,
      false,
      "an old image failure does not affect a replacement URL",
    );
    const expired = { ...owner, avatarUrl: signed(Date.now() - 120_000) };
    assert.equal(useRequestOwnerAvatar(expired).sourceUri, profileUrl);
    assert.equal(calls.at(-1)!.enabled, true);
    profileUrl = expired.avatarUrl;
    assert.equal(
      useRequestOwnerAvatar(expired).sourceUri,
      undefined,
      "expired cached profile URLs are not handed back to Image",
    );
    profileUrl = null;
    assert.equal(useRequestOwnerAvatar(expired).sourceUri, null);
    const hidden = useRequestOwnerAvatar(replaced, false);
    failed = undefined;
    hidden.onImageError();
    assert.equal(failed, undefined);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
