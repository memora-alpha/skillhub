import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { scheduleItems } from "../src/features/learning-paths/schemas/schedule-input";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

test("schedule accepts typed minutes while retaining the existing start control and locked state", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/schedule-time-fields.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./schedule-time-fields.tsx");
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View" },
    "@/components/Input": { Input: "Input" },
    "@/components/DateTimeField": { DateTimeField: "DateTimeField" },
    "@/components/feature-page": { Copy: "Copy" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ScheduleTimeFields } = local(
      filename,
    ) as typeof import("../src/features/learning-paths/components/schedule-time-fields");
    let start = "2098-12-31T23:30";
    let minutes = "60";
    const render = (disabled = false) =>
      elements(
        ScheduleTimeFields({
          local: start,
          minutes,
          disabled,
          onLocalChange: (value) => {
            start = value;
          },
          onMinutesChange: (value) => {
            minutes = value;
          },
        }),
      );
    const tree = render();
    const date = tree.find((item) => item.type === "DateTimeField")!;
    assert.equal(date.props.value, start);
    assert.equal(date.props.label, "Ngày và giờ bắt đầu");
    assert.equal(
      date.props.mode,
      undefined,
      "the shared control keeps both calendar and time wheel",
    );
    const input = tree.find((item) => item.type === "Input")!;
    assert.equal(input.props.label, "Học trong bao lâu?");
    assert.equal(input.props.value, "60");
    assert.equal(input.props.keyboardType, "number-pad");
    assert.equal(input.props.inputMode, "numeric");
    assert.equal(input.props.editable, true);
    (input.props.onChangeText as (value: string) => void)("");
    assert.equal(
      minutes,
      "",
      "clearing the field remains possible before typing a replacement",
    );
    (input.props.onChangeText as (value: string) => void)("75");
    assert.equal(start, "2098-12-31T23:30");
    assert.equal(minutes, "75");
    const [slot] = scheduleItems({ items: [{ local: start, minutes }] });
    assert.equal(
      Date.parse(slot!.endAt) - Date.parse(slot!.startAt),
      75 * 60_000,
    );
    const locked = render(true);
    assert.equal(
      locked.find((item) => item.type === "DateTimeField")!.props.disabled,
      true,
    );
    const lockedInput = locked.find((item) => item.type === "Input")!;
    assert.equal(lockedInput.props.editable, false);
    (lockedInput.props.onChangeText as (value: string) => void)("180");
    assert.equal(minutes, "75");
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});

test("typed duration must be a whole number from 60 to 180 before producing an API payload", () => {
  for (const minutes of ["60", "75", "180"]) {
    const [slot] = scheduleItems({
      items: [{ local: "2098-12-31T23:30", minutes }],
    });
    assert.equal(
      Date.parse(slot!.endAt) - Date.parse(slot!.startAt),
      Number(minutes) * 60_000,
    );
  }
  for (const minutes of ["", "59", "181", "90.5", "1e2", "-60", "abc"]) {
    assert.throws(
      () => scheduleItems({ items: [{ local: "2098-12-31T23:30", minutes }] }),
      `reject ${JSON.stringify(minutes)}`,
    );
  }
});
