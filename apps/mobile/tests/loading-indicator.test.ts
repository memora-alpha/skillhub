import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("loading dots expose a single accessible busy state and stop for blur, background and reduced motion", async () => {
  const local = createRequire(
    new URL("../src/components/LoadingIndicator.tsx", import.meta.url),
  );
  const filename = local.resolve("./LoadingIndicator.tsx");
  let focused = true,
    slot = 0;
  let grouped = false;
  const states: unknown[] = [];
  let cleanup: (() => void) | undefined;
  let preference!: (value: boolean) => void, appState!: (state: string) => void;
  let resolvePreference!: (value: boolean) => void;
  let removed = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = [
    mock.module(pathToFileURL(local.resolve("react")), {
      namedExports: {
        useState: (initial: unknown) => {
          const index = slot++;
          if (!(index in states)) states[index] = initial;
          return [states[index], (value: unknown) => (states[index] = value)];
        },
        useEffect: (fn: () => () => void) => {
          if (!cleanup) cleanup = fn();
        },
      },
    }),
    mock.module(pathToFileURL(local.resolve("react/jsx-runtime")), {
      namedExports: { jsx, jsxs: jsx },
    }),
    mock.module(pathToFileURL(local.resolve("./LoadingScreenBoundary")), {
      namedExports: { useLoadingVisible: () => focused },
    }),
    mock.module(pathToFileURL(local.resolve("./use-screen-loading")), {
      namedExports: {
        useScreenLoading: (presentation: string) =>
          grouped && presentation === "screen",
      },
    }),
    mock.module(pathToFileURL(local.resolve("react-native-reanimated")), {
      defaultExport: { View: "Dot" },
    }),
    mock.module(pathToFileURL(local.resolve("react-native")), {
      namedExports: {
        View: "View",
        StyleSheet: { create: (value: unknown) => value },
        AppState: {
          currentState: "active",
          addEventListener: (_name: string, fn: typeof appState) => {
            appState = fn;
            return { remove: () => removed++ };
          },
        },
        AccessibilityInfo: {
          isReduceMotionEnabled: () =>
            new Promise<boolean>((resolve) => (resolvePreference = resolve)),
          addEventListener: (_name: string, fn: typeof preference) => {
            preference = fn;
            return { remove: () => removed++ };
          },
        },
      },
    }),
  ];
  try {
    delete local.cache[filename];
    const { LoadingIndicator } = local(filename);
    const render = (presentation = "screen") => {
      slot = 0;
      return LoadingIndicator({
        accessibilityLabel: "Đang tải lịch học",
        presentation,
      });
    };
    const dots = (tree: ReturnType<typeof render>) =>
      tree.props.children.props.children;
    const moving = (tree: ReturnType<typeof render>) =>
      dots(tree).every(
        (dot: { props: { style: { animationName?: unknown }[] } }) =>
          !!dot.props.style.at(-1)?.animationName,
      );
    const initial = render();
    assert.equal(initial.props.accessibilityRole, "progressbar");
    assert.deepEqual(initial.props.accessibilityState, { busy: true });
    assert.equal(initial.props.accessibilityLabel, "Đang tải lịch học");
    assert.equal(
      initial.props.style[0].alignSelf,
      "center",
      "standalone loading cannot hug the left edge",
    );
    assert.equal(
      moving(initial),
      false,
      "wait for the accessibility preference before starting",
    );
    resolvePreference(false);
    await Promise.resolve();
    assert.equal(moving(render()), true);
    focused = false;
    assert.equal(moving(render()), false);
    focused = true;
    appState("background");
    assert.equal(moving(render()), false);
    appState("active");
    assert.equal(moving(render()), true);
    preference(true);
    assert.equal(moving(render()), false);
    preference(false);
    assert.equal(moving(render()), true);
    grouped = true;
    assert.equal(
      render(),
      null,
      "screen reads register without drawing a local loader",
    );
    assert.equal(render("silent"), null, "background refresh draws nothing");
    assert.ok(
      render("inline").props.children,
      "the central indicator and explicit action feedback still render",
    );
    const placeholder = render("placeholder");
    assert.equal(
      placeholder.props.children,
      undefined,
      "secondary content has a static placeholder, no animated dots",
    );
    cleanup?.();
    assert.equal(removed, 2);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
