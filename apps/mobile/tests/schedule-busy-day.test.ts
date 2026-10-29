import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { previewScheduleItems } from "../src/features/learning-paths/utils/schedule-conflicts";
import {
  agreementPath,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";
import { sessionRecord } from "./fixtures/sessions-client";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join("");
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (value && typeof value === "object" && "props" in value)
    return text((value as Element).props.children);
  return "";
}

test("busy-day feedback uses scoped date queries, updates overlaps, and never treats failed or denied reads as free time", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/schedule-busy-day.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./schedule-busy-day.tsx");
  const slot = previewScheduleItems([
    { local: "2098-01-02T19:00", minutes: "120" },
  ])[0]!;
  const busy = {
    id: "busy",
    status: "CONFIRMED",
    role: "TEACHER",
    startAt: new Date(
      new Date(slot.startAt).getTime() + 3_600_000,
    ).toISOString(),
    endAt: new Date(new Date(slot.endAt).getTime() + 3_600_000).toISOString(),
  };
  const query = {
    data: [
      busy,
      { ...busy, id: "cancelled", role: "LEARNER", status: "CANCELLED" },
    ],
    error: null as unknown,
    denial: undefined as string | undefined,
    isFetching: false,
    refetch: () => {
      retries++;
    },
  };
  let retries = 0,
    focused = true;
  const ranges: { range: Record<string, string>; allowed: boolean }[] = [];
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const mocks = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (v: unknown) => v },
    },
    "expo-router": { useIsFocused: () => focused },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "@/features/sessions": {
      deviceTimezone: () => "UTC",
      listIsLimited: (items: unknown[]) => items.length >= 100,
      useSessionList: (
        range: Record<string, string>,
        _timezone: string,
        allowed: boolean,
      ) => {
        ranges.push({ range, allowed });
        return { ...query, enabled: allowed };
      },
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ScheduleBusyDay } = local(filename);
    const render = (value = slot, allowed = true) =>
      ScheduleBusyDay({ slot: value, allowed });
    let tree = render();
    assert.match(text(tree), /Trùng lịch dạy/);
    assert.doesNotMatch(text(tree), /Khoảng trùng|Lịch học:/);
    assert.equal(
      ScheduleBusyDay({ slot, allowed: true, warnedSessionIds: [busy.id] }),
      null,
      "busy-day panel does not repeat a conflict already shown on its card",
    );
    assert.deepEqual(Object.keys(ranges[0]!.range).sort(), ["from", "to"]);
    const later = {
      ...slot,
      startAt: busy.endAt,
      endAt: new Date(Date.parse(busy.endAt) + 3_600_000).toISOString(),
    };
    tree = render(later);
    assert.doesNotMatch(text(tree), /Trùng lịch/);
    assert.match(text(tree), /Lịch dạy:/);
    assert.deepEqual(
      ranges[0]!.range,
      ranges[1]!.range,
      "clock edits reuse the same day query",
    );
    query.error = new Error("offline");
    tree = render();
    assert.match(text(tree), /Chưa đối chiếu được/);
    assert.doesNotMatch(text(tree), /Lịch dạy:|Chưa thấy buổi học/);
    (
      elements(tree).find((e) => e.type === "Feedback")!.props
        .retry as () => void
    )();
    assert.equal(retries, 1);
    query.error = null;
    query.denial = "forbidden";
    assert.doesNotMatch(text(render()), /Lịch dạy:|Chưa thấy buổi học/);
    query.denial = undefined;
    focused = false;
    assert.match(text(render()), /Chưa đối chiếu lịch đã chốt/);
    assert.equal(ranges.at(-1)!.allowed, false);
    focused = true;
    render(slot, false);
    assert.equal(ranges.at(-1)!.allowed, false);
    query.data = [];
    query.isFetching = true;
    // An initial unresolved query must not announce an empty schedule.
    const initialQuery = query.data;
    (query as { data: unknown }).data = undefined;
    assert.doesNotMatch(text(render()), /Chưa thấy buổi học/);
    query.data = initialQuery;
    query.isFetching = false;
    assert.match(
      text(render()),
      /Chưa thấy buổi học đã chốt của bạn trong ngày này/,
    );
    query.data = Array.from({ length: 100 }, (_, i) => ({
      ...busy,
      id: String(i),
    }));
    assert.match(text(render()), /giới hạn 100 buổi/);
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});

test("session cards show exact conflicts immediately and only load busy hours for the open session", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/schedule-session-editor.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./schedule-session-editor.tsx");
  const path = withConfirmedSchedules(agreementPath(true));
  const plan = path.plans[0]!;
  plan.totalSessions = 2;
  plan.sessionOutline.push({ sessionNo: 2, content: "Buổi thứ hai" });
  let items = [
    { local: "2098-01-02T19:00", minutes: "60" },
    { local: "2098-01-02T19:30", minutes: "60" },
  ];
  path.plans[1]!.schedule!.items = previewScheduleItems([
    { local: "2098-01-02T19:45", minutes: "60" },
  ]);
  const edits: (number | null)[] = [];
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const mocks = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (v: unknown) => v },
    },
    "react-hook-form": {
      useWatch: () => items,
      useFormState: () => ({ errors: {} }),
      Controller: "Controller",
    },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/learning-flow": { FlowSection: "Section" },
    "./schedule-time-fields": { ScheduleTimeFields: "TimeFields" },
    "./schedule-timeline-item": { ScheduleTimelineItem: "TimelineItem" },
    "./schedule-busy-day": { ScheduleBusyDay: "BusyDay" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ScheduleSessionEditor } = local(filename);
    const render = (active: number | null = null) =>
      ScheduleSessionEditor({
        path,
        plan,
        control: {},
        disabled: false,
        active,
        onEdit: (index: number | null) => edits.push(index),
      });
    let tree = render();
    assert.match(text(tree), /Buổi 2 trùng với buổi 1.*19:00/);
    assert.equal(
      text(tree).split("Buổi 2 trùng với buổi 1").length - 1,
      1,
      "one overlapping pair is only explained on the session to edit",
    );
    assert.match(text(tree), /lịch người còn lại dạy/);
    assert.equal(elements(tree).filter((e) => e.type === "BusyDay").length, 0);
    (
      elements(tree).find(
        (e) => e.props.accessibilityLabel === "Sửa lịch buổi 2",
      )!.props.onPress as () => void
    )();
    assert.deepEqual(edits, [1]);
    tree = render(1);
    const busy = elements(tree).filter((e) => e.type === "BusyDay");
    assert.equal(busy.length, 1);
    assert.equal((busy[0]!.props.slot as { sessionNo: number }).sessionNo, 2);
    items = items.map((item) => ({
      ...item,
      local: item.local.replace("01-02", "01-03"),
    }));
    items[1]!.local = "2098-01-03T20:00";
    assert.equal(
      elements(render()).filter((e) => e.type === "Notice").length,
      0,
      "fixing the times removes warnings without submitting",
    );
    const existingSlot = previewScheduleItems(items)[0]!;
    const existingConflict = {
      slot: existingSlot,
      session: {
        ...sessionRecord(),
        status: "CONFIRMED",
        pathId: "another-path",
        ...existingSlot,
        role: "TEACHER",
      },
    };
    const existingTree = ScheduleSessionEditor({
      path,
      plan,
      control: {},
      disabled: false,
      active: null,
      onEdit: () => {},
      existingConflicts: [existingConflict, existingConflict],
    });
    assert.match(text(existingTree), /Trùng lịch dạy ở lộ trình khác/);
    assert.equal(
      elements(existingTree).filter((e) => e.type === "Notice").length,
      1,
    );
    assert.doesNotMatch(text(existingTree), /Khoảng trùng/);
    assert.equal(
      text(existingTree).split("Trùng lịch dạy ở lộ trình khác").length - 1,
      1,
      "duplicate conflict records produce one warning",
    );
    assert.equal(
      elements(existingTree).filter((e) => e.type === "BusyDay").length,
      0,
      "another-path warning is visible without opening a session",
    );
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
