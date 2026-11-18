import assert from "node:assert/strict";
import { test } from "node:test";
import { createAchievementsApi } from "../src/features/achievements/api/achievements-api";
import {
  achievementTitleLabel,
  achievementDescriptionLabel,
} from "../src/constants/achievement-copy";
import {
  orderedAchievements,
  achievementGroup,
} from "../src/features/achievements/utils/achievement-presentation";
import { AppError } from "../src/lib/http/errors";
import type { HttpClient } from "../src/lib/http/client";

const item = {
  code: "FIRST_PATH",
  title: "First Path",
  description: "Complete one learning path.",
  unlockedAt: "2026-11-13T08:00:00Z",
};
test("achievement copy is localized for display while custom server copy and raw API titles remain intact", async () => {
  const api = createAchievementsApi({
    request: async () => ({ selectedTitle: "First Path", items: [item] }),
  } as unknown as HttpClient);
  const result = await api.mine();
  assert.equal(result.selectedTitle, "First Path");
  assert.equal(
    achievementTitleLabel(result.items[0]!.title),
    "Bước chân đầu tiên",
  );
  assert.match(
    achievementDescriptionLabel(item.description),
    /lộ trình học đầu tiên/,
  );
  assert.equal(
    achievementTitleLabel("Danh hiệu do quản trị viên đặt"),
    "Danh hiệu do quản trị viên đặt",
  );
  assert.equal(achievementGroup("FUTURE_CUSTOM"), "Khác");
  for (const text of ["constructor", "__proto__", "toString"]) {
    assert.equal(achievementTitleLabel(text), text);
    assert.equal(achievementDescriptionLabel(text), text);
  }
});
test("selection sends code, hiding sends an empty body, and PATCH never replays after token renewal", async () => {
  const calls: unknown[] = [];
  const api = createAchievementsApi({
    request: async (path: string, options: unknown) => {
      calls.push([path, options]);
      return { selectedTitle: "First Path" };
    },
  } as unknown as HttpClient);
  await api.selectTitle("FIRST_PATH");
  await api.selectTitle(null);
  assert.deepEqual(calls, [
    [
      "/me/achievements/selected-title",
      {
        authenticated: true,
        signal: undefined,
        method: "PATCH",
        body: { code: "FIRST_PATH" },
        replayAfterRenewal: false,
      },
    ],
    [
      "/me/achievements/selected-title",
      {
        authenticated: true,
        signal: undefined,
        method: "PATCH",
        body: {},
        replayAfterRenewal: false,
      },
    ],
  ]);
  await assert.rejects(api.selectTitle(""));
  assert.equal(calls.length, 2);
});
test("malformed or duplicate achievement entries fail instead of rendering a misleading collection", async () => {
  for (const items of [
    [item, item],
    [{ ...item, unlockedAt: "invalid" }],
    [{ ...item, title: "" }],
  ]) {
    const api = createAchievementsApi({
      request: async () => ({ selectedTitle: null, items }),
    } as unknown as HttpClient);
    await assert.rejects(
      api.mine(),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
  }
});
test("session changes discard late responses and denied reads retain their status", async () => {
  let current = true;
  const api = createAchievementsApi(
    {
      request: async () => {
        current = false;
        return { selectedTitle: null, items: [] };
      },
    } as unknown as HttpClient,
    () => current,
  );
  await assert.rejects(
    api.mine(),
    (error) => error instanceof AppError && error.kind === "session",
  );
  const denied = new AppError("http", 403);
  await assert.rejects(
    createAchievementsApi({
      request: async () => {
        throw denied;
      },
    } as unknown as HttpClient).mine(),
    (error) => error === denied,
  );
});
test("collection ordering is newest first without mutating the server's array", () => {
  const older = {
    ...item,
    code: "VERIFIED_MEMBER",
    unlockedAt: "2026-11-01T00:00:00Z",
  };
  const items = [older, item];
  assert.deepEqual(
    orderedAchievements(items).map((row) => row.code),
    ["FIRST_PATH", "VERIFIED_MEMBER"],
  );
  assert.equal(items[0], older);
});
