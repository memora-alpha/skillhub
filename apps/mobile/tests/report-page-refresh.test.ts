import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("Report page shows pull progress only for an explicit refresh, deduplicates pulls and stops updating after unmount", async () => {
  const local = createRequire(
    new URL(
      "../src/features/reports/components/report-ui.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./report-ui.tsx");
  const updates: boolean[] = [],
    cleanup: (() => void)[] = [];
  let reads = 0,
    release: (() => void) | undefined;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = Object.entries({
    react: {
      useState: () => [false, (value: boolean) => updates.push(value)],
      useRef: (value: unknown) => ({ current: value }),
      useEffect: (effect: () => () => void) => cleanup.push(effect()),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Text: "Text",
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "expo-router": { useRouter: () => ({ push() {} }) },
    "@/features/shell": { AppScreenLayout: "Layout" },
    "@/components/KeyboardFormScrollView": { KeyboardFormScrollView: "Scroll" },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ReportPage } = local(filename);
    const page = ReportPage({
      title: "Test",
      children: "body",
      onRefresh: () => {
        reads++;
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    const scroll = page.props.children();
    assert.equal(scroll.props.refreshing, false);
    assert.equal(reads, 0);
    scroll.props.onRefresh();
    scroll.props.onRefresh();
    await Promise.resolve();
    assert.equal(reads, 1);
    assert.deepEqual(updates, [true]);
    release!();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(updates, [true, false]);
    scroll.props.onRefresh();
    await Promise.resolve();
    assert.equal(reads, 2);
    cleanup.forEach((fn) => fn());
    release!();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(updates, [true, false, true]);
  } finally {
    delete local.cache[filename];
    mocks.forEach((item) => item.restore());
  }
});
