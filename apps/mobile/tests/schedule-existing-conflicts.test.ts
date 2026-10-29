import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { previewScheduleItems } from "../src/features/learning-paths/utils/schedule-conflicts";
import {
  existingScheduleConflicts,
  existingScheduleConflictMessage,
  existingScheduleRange,
} from "../src/features/learning-paths/utils/schedule-existing-conflicts";
import { agreementPath } from "./fixtures/learning-agreement";
import { sessionRecord } from "./fixtures/sessions-client";
import type { LearningSession } from "../src/features/sessions/types";

const slots = previewScheduleItems([
  { local: "2098-01-02T19:00", minutes: "90" },
  { local: "2098-02-03T20:00", minutes: "60" },
]);
const busy: LearningSession = {
  ...sessionRecord(),
  status: "CONFIRMED",
  pathId: "another-path",
  ...slots[1]!,
  role: "LEARNER",
};

test("all draft sessions are checked against another path, including exactly equal times; cancelled and same-path sessions are excluded", () => {
  const conflicts = existingScheduleConflicts(
    slots,
    [
      busy,
      { ...busy, id: "cancelled", status: "CANCELLED" },
      { ...busy, id: "same-path", pathId: "editing-path" },
      {
        ...busy,
        id: "adjacent",
        startAt: slots[1]!.endAt,
        endAt: new Date(Date.parse(slots[1]!.endAt) + 3_600_000).toISOString(),
      },
    ],
    "editing-path",
  );
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]!.slot.sessionNo, 2);
  const message = existingScheduleConflictMessage(conflicts[0]!);
  assert.match(message, /Trùng lịch học ở lộ trình khác/);
  assert.doesNotMatch(message, /Khoảng trùng/);
  assert.deepEqual(existingScheduleConflicts([], [busy], "editing-path"), []);
});

test("the existing-schedule query covers the whole generated schedule without requiring an expanded session", () => {
  assert.equal(existingScheduleRange([]), undefined);
  const range = existingScheduleRange([...slots].reverse())!;
  assert.ok(Date.parse(range.from) < Date.parse(slots[0]!.startAt));
  assert.ok(Date.parse(range.to) >= Date.parse(slots[1]!.endAt));
  assert.deepEqual(Object.keys(range).sort(), ["from", "to"]);
});

test("the automatic check loads all filled dates, waits for the initial read, and cannot submit stale times or cached denied conflicts", async () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/hooks/use-existing-schedule-check.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-existing-schedule-check.ts");
  const path = agreementPath(),
    plan = path.plans[0]!;
  let items = [
    { local: "2098-01-02T19:00", minutes: "90" },
    { local: "2098-02-03T20:00", minutes: "60" },
  ];
  const query = {
    data: undefined as LearningSession[] | undefined,
    error: null as unknown,
    denial: undefined as string | undefined,
    refetch: async (): Promise<{
      data: LearningSession[] | undefined;
      error: unknown;
    }> => ({ data: query.data, error: query.error }),
  };
  const ranges: unknown[] = [];
  let ref: { current: unknown } | undefined;
  let focused = true;
  const mocks = Object.entries({
    react: {
      useRef: (current: unknown) => (ref ??= { current }),
      useState: (initial: unknown) => [initial, () => {}],
      useEffect: () => {},
    },
    "expo-router": { useIsFocused: () => focused },
    "react-hook-form": { useWatch: () => items },
    "@/features/sessions": {
      deviceTimezone: () => "UTC",
      listIsLimited: (data: unknown[]) => data.length >= 100,
      useSessionList: (range: unknown, _timezone: string, allowed: boolean) => {
        ranges.push(range);
        return { ...query, enabled: allowed };
      },
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useExistingScheduleCheck } = local(filename);
    const render = () => useExistingScheduleCheck({}, plan, path.id, true);
    let check = render();
    assert.equal(check.pending, true);
    assert.equal((await check.validate(slots)).unavailable, true);
    assert.deepEqual(ranges[0], existingScheduleRange(slots));
    query.data = [busy];
    check = render();
    assert.equal(check.pending, false);
    assert.equal(check.conflicts.length, 1);
    const staleValidate = check.validate;
    items = items.map((item) => ({
      ...item,
      local: item.local.replace("20:00", "21:00"),
    }));
    check = render();
    assert.equal(check.conflicts.length, 0);
    assert.equal((await staleValidate(slots)).unavailable, true);
    assert.equal(
      (await check.validate(previewScheduleItems(items))).pending,
      false,
    );
    query.error = new Error("offline");
    check = render();
    assert.equal(check.error, query.error);
    assert.equal(check.conflicts.length, 0);
    query.error = null;
    query.denial = "forbidden";
    check = render();
    assert.equal(check.denial, "forbidden");
    assert.equal(check.conflicts.length, 0);
    query.denial = undefined;
    query.data = Array.from({ length: 100 }, () => busy);
    assert.equal(render().limited, true);
    focused = false;
    assert.equal(render().conflicts.length, 0);
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
