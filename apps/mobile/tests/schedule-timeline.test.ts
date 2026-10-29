import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}

test("timeline reaches the next marker when an error or expanded editor changes the row height", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/schedule-timeline-item.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./schedule-timeline-item.tsx");
  let height = 0;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const mocks = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useState: () => [
        height,
        (value: number) => {
          height = value;
        },
      ],
    },
    "react-native": {
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  mocks.push(
    mock.module(pathToFileURL(local.resolve("react-native-svg")), {
      defaultExport: { __esModule: true, default: "Svg", Line: "Line" },
    }),
  );
  try {
    delete local.cache[filename];
    const { ScheduleTimelineItem } = local(filename);
    const render = (last = false, gap = 12) =>
      ScheduleTimelineItem({
        last,
        gap,
        children: "Session content",
      }) as Element;
    const measure = (value: number) => {
      const tree = render();
      (tree.props.onLayout as (event: unknown) => void)({
        nativeEvent: { layout: { height: value } },
      });
      return elements(render());
    };
    assert.equal(
      elements(render()).some((element) => element.type === "Line"),
      false,
    );
    for (const value of [120, 218, 640, 120]) {
      const tree = measure(value);
      const svg = tree.find((element) => element.type === "Svg")!;
      const line = tree.find((element) => element.type === "Line")!;
      const connector = tree.find(
        (element) => element.props.pointerEvents === "none",
      )!;
      const [baseStyle, measuredStyle] = connector.props.style as {
        top: number;
        height: number;
      }[];
      assert.equal(svg.props.height, value + 12);
      assert.equal(line.props.y2, value + 12);
      assert.equal(
        baseStyle!.top + measuredStyle!.height,
        value + 12 + 17,
        "connector ends at the next row marker center",
      );
    }
    assert.equal(
      elements(render(true)).some((element) => element.type === "Line"),
      false,
      "last marker has no trailing line",
    );
    assert.equal(
      elements(render(false, 10)).find((element) => element.type === "Line")!
        .props.y2,
      height + 10,
      "read-only plan and schedule cards retain their own spacing",
    );
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
