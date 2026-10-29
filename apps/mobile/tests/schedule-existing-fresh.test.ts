import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { Control } from "react-hook-form";
import type { ScheduleInput } from "../src/features/learning-paths/schemas/schedule-input";
import type { LearningSession } from "../src/features/sessions/types";
import { previewScheduleItems } from "../src/features/learning-paths/utils/schedule-conflicts";
import { existingScheduleConflictMessage } from "../src/features/learning-paths/utils/schedule-existing-conflicts";
import { agreementPath } from "./fixtures/learning-agreement";
import { sessionRecord } from "./fixtures/sessions-client";

function harness() {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/hooks/use-existing-schedule-check.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-existing-schedule-check.ts");
  const path = agreementPath();
  const items = [{ local: "2026-10-28T21:00", minutes: "60" }];
  const slots = previewScheduleItems(items);
  const busy: LearningSession = {
    ...sessionRecord(),
    status: "CONFIRMED",
    role: "LEARNER",
    pathId: "other-path",
    startAt: "2026-10-28T14:00:00.000Z",
    endAt: "2026-10-28T15:00:00.000Z",
  };
  let serverData: LearningSession[] = [],
    serverError: unknown = null;
  let calls = 0,
    effectCursor = 0,
    validating = false;
  const effects: { deps: unknown[]; cleanup?: () => void }[] = [];
  let ref: { current: unknown } | undefined;
  const query = {
    queryKey: ["sessions", "viewer", 1],
    data: [] as LearningSession[] | undefined,
    error: null as unknown,
    denial: undefined as string | undefined,
    isFetching: false,
    refetch: async (): Promise<{
      data: LearningSession[] | undefined;
      error: unknown;
    }> => {
      calls++;
      await Promise.resolve();
      query.error = serverError;
      if (!serverError) query.data = serverData;
      return { data: query.data, error: query.error };
    },
  };
  const mocks = Object.entries({
    react: {
      useRef: (current: unknown) => (ref ??= { current }),
      useState: () => [
        validating,
        (value: boolean) => {
          validating = value;
        },
      ],
      useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
        const index = effectCursor++;
        const previous = effects[index];
        if (
          !previous ||
          deps.some((value, index) => !Object.is(value, previous.deps[index]))
        ) {
          previous?.cleanup?.();
          const cleanup = effect();
          effects[index] = {
            deps,
            cleanup: typeof cleanup === "function" ? cleanup : undefined,
          };
        }
      },
    },
    "expo-router": { useIsFocused: () => true },
    "react-hook-form": { useWatch: () => items },
    "@/features/sessions": {
      deviceTimezone: () => "Asia/Ho_Chi_Minh",
      listIsLimited: (data: unknown[]) => data.length >= 100,
      useSessionList: (
        _range: unknown,
        _timezone: string,
        enabled: boolean,
      ) => ({ ...query, enabled }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  delete local.cache[filename];
  const { useExistingScheduleCheck } = local(
    filename,
  ) as typeof import("../src/features/learning-paths/hooks/use-existing-schedule-check");
  return {
    busy,
    slots,
    query,
    calls: () => calls,
    server: (data: LearningSession[], error: unknown = null) => {
      serverData = data;
      serverError = error;
    },
    render: (applyVersion = 1) => {
      effectCursor = 0;
      return useExistingScheduleCheck(
        {} as Control<ScheduleInput>,
        path.plans[0]!,
        path.id,
        true,
        applyVersion,
      );
    },
    unmount: () => effects.forEach((effect) => effect.cleanup?.()),
    cleanup: () => {
      effects.forEach((effect) => effect.cleanup?.());
      delete local.cache[filename];
      mocks.reverse().forEach((item) => item.restore());
    },
  };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("28 October 21:00–22:00 matches the existing 14:00–15:00 UTC Session; reapplying the same template forces a fresh read", async () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = "Asia/Ho_Chi_Minh";
  const h = harness();
  try {
    h.render(1);
    await tick();
    assert.equal(h.calls(), 1);
    assert.equal(h.render(1).conflicts.length, 0);
    h.server([h.busy]);
    h.render(2);
    await tick();
    const current = h.render(2);
    assert.equal(
      h.calls(),
      2,
      "same dates and fresh cache must not suppress reapplying",
    );
    assert.equal(current.conflicts.length, 1);
    assert.equal(h.slots[0]!.startAt, h.busy.startAt);
    assert.equal(h.slots[0]!.endAt, h.busy.endAt);
    const message = existingScheduleConflictMessage(current.conflicts[0]!);
    assert.match(message, /21:00–22:00/);
    assert.match(message, /28\/10\/2026/);
  } finally {
    h.cleanup();
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("submit rechecks the server even when cached results are empty, and unavailable or incomplete reads cannot authorize saving", async () => {
  const h = harness();
  try {
    h.render();
    await tick();
    const check = h.render();
    const busy = {
      ...h.busy,
      startAt: h.slots[0]!.startAt,
      endAt: h.slots[0]!.endAt,
    };
    assert.equal(check.conflicts.length, 0);
    h.server([busy]);
    const fresh = await check.validate(h.slots);
    assert.equal(fresh.unavailable, false);
    assert.equal(fresh.conflicts.length, 1);
    h.server([], new Error("offline"));
    assert.equal((await h.render().validate(h.slots)).unavailable, true);
    assert.equal(h.render().blocked, true);
    h.server(Array.from({ length: 100 }, () => busy));
    assert.equal((await h.render().validate(h.slots)).unavailable, true);
    assert.equal(h.render().blocked, true);
    h.server([]);
    assert.equal((await h.render().validate(h.slots)).unavailable, false);
  } finally {
    h.cleanup();
  }
});

test("leaving the editor while the fresh read is pending cannot authorize a late save", async () => {
  const h = harness();
  try {
    h.render();
    await tick();
    let finish: () => void = () => {};
    h.query.refetch = () =>
      new Promise((resolve) => {
        finish = () => resolve({ data: [], error: null });
      });
    const check = h.render();
    const result = check.validate(h.slots);
    assert.equal((await check.validate(h.slots)).pending, true);
    h.unmount();
    finish();
    assert.equal((await result).unavailable, true);
  } finally {
    h.cleanup();
  }
});
