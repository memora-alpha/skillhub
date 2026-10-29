import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createScreenLoadingStore } from "../src/components/screen-loading-store";

test("screen loading waits for every independent read and keeps other screens and dialogs isolated", () => {
  const screen = createScreenLoadingStore();
  const dialog = createScreenLoadingStore();
  const before = screen.getSnapshot();
  let notifications = 0;
  const unsubscribe = screen.subscribe(() => notifications++);
  const finishMain = screen.register(Symbol(), "Main data");
  const finishDependent = screen.register(Symbol(), "Required dependent data");
  assert.equal(screen.getSnapshot().busy, true);
  assert.equal(dialog.getSnapshot().busy, false);
  finishMain();
  assert.equal(
    screen.getSnapshot().busy,
    true,
    "finishing one request cannot reveal an incomplete screen",
  );
  const finishDialog = dialog.register(Symbol(), "Dialog data");
  finishDependent();
  assert.equal(screen.getSnapshot().busy, false);
  assert.equal(dialog.getSnapshot().busy, true);
  const settled = screen.getSnapshot();
  finishDependent();
  assert.equal(
    screen.getSnapshot(),
    settled,
    "repeated cleanup keeps a stable external-store snapshot",
  );
  assert.notEqual(before, settled);
  assert.ok(notifications > 0);
  unsubscribe();
  finishDialog();
});

test("loader registration cleans up on completion, unmount and scope change; placeholders/actions never block the screen", () => {
  const local = createRequire(
    new URL("../src/components/use-screen-loading.ts", import.meta.url),
  );
  const filename = local.resolve("./use-screen-loading.ts");
  const screen = createScreenLoadingStore();
  const nextScreen = createScreenLoadingStore();
  let scope: typeof screen | null = screen;
  type Instance = {
    ref?: { current: unknown };
    deps?: unknown[];
    cleanup?: () => void;
  };
  let instance: Instance = {};
  const context = mock.module(pathToFileURL(local.resolve("react")), {
    namedExports: {
      createContext: () => ({}),
      useContext: () => scope,
      useRef: (value: unknown) => (instance.ref ??= { current: value }),
      useLayoutEffect: (
        effect: () => (() => void) | undefined,
        deps: unknown[],
      ) => {
        if (
          instance.deps &&
          deps.every((value, i) => Object.is(value, instance.deps![i]))
        )
          return;
        instance.cleanup?.();
        instance.deps = deps;
        instance.cleanup = effect();
      },
    },
  });
  try {
    delete local.cache[filename];
    const { useScreenLoading } = local(
      filename,
    ) as typeof import("../src/components/use-screen-loading");
    const first: Instance = {},
      second: Instance = {};
    const render = (
      target: Instance,
      mode: Parameters<typeof useScreenLoading>[0],
      busy = true,
    ) => {
      instance = target;
      return useScreenLoading(mode, busy, "Loading");
    };
    assert.equal(render(first, "screen"), true);
    render(second, "screen");
    render(first, "screen", false);
    assert.equal(screen.getSnapshot().busy, true);
    second.cleanup?.();
    assert.equal(screen.getSnapshot().busy, false);
    for (const mode of ["inline", "placeholder", "silent"] as const) {
      assert.equal(render(first, mode), false);
      assert.equal(screen.getSnapshot().busy, false);
    }
    render(first, "screen");
    scope = nextScreen;
    render(first, "screen");
    assert.equal(screen.getSnapshot().busy, false);
    assert.equal(nextScreen.getSnapshot().busy, true);
    scope = null;
    assert.equal(
      render(first, "screen"),
      false,
      "startup can still render a standalone loader",
    );
    assert.equal(nextScreen.getSnapshot().busy, false);
  } finally {
    delete local.cache[filename];
    context.restore();
  }
});

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

test("screen boundary keeps children mounted, centers one loader, and restores interaction after reads settle", () => {
  const local = createRequire(
    new URL("../src/components/ScreenLoadingBoundary.tsx", import.meta.url),
  );
  const filename = local.resolve("./ScreenLoadingBoundary.tsx");
  const store = createScreenLoadingStore();
  let focused = true;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    react: {
      useMemo: () => store,
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
        snapshot(),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "expo-router": { useIsFocused: () => focused },
    "./LoadingIndicator": { LoadingIndicator: "Loader" },
    "./ScreenLoadingContent": { ScreenLoadingContent: "Content" },
    "./use-screen-loading": { ScreenLoadingContext: { Provider: "Provider" } },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ScreenLoadingBoundary } = local(
      filename,
    ) as typeof import("../src/components/ScreenLoadingBoundary");
    const child = { type: "Form", props: { draft: "preserved", children: [] } };
    const render = () =>
      elements(ScreenLoadingBoundary({ children: child as never }));
    const first = store.register(Symbol(), "First");
    const second = store.register(Symbol(), "Second");
    const tree = render();
    assert.ok(tree.includes(child));
    assert.equal(tree.filter((node) => node.type === "Loader").length, 1);
    const content = tree.find((node) => node.props.children === child)!;
    assert.equal(content.props.waiting, true);
    const overlay = tree.find(
      (node) =>
        node.props.pointerEvents === "none" &&
        node.props.style &&
        !Array.isArray(node.props.style),
    )!;
    assert.equal(
      (overlay.props.style as Record<string, unknown>).alignItems,
      "center",
    );
    assert.equal(
      (overlay.props.style as Record<string, unknown>).justifyContent,
      "center",
    );
    first();
    assert.equal(render().filter((node) => node.type === "Loader").length, 1);
    focused = false;
    assert.equal(render().filter((node) => node.type === "Loader").length, 0);
    focused = true;
    second();
    assert.equal(render().filter((node) => node.type === "Loader").length, 0);
    assert.equal(
      render().find((node) => node.props.children === child)!.props.waiting,
      false,
    );
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});

test("wallet refresh retains visible financial data without a loader; read denial still hides private content", () => {
  const local = createRequire(
    new URL(
      "../src/features/wallet/components/financial-read-state.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./financial-read-state.tsx");
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", Text: "Text" },
    "@/components/LoadingIndicator": { LoadingIndicator: "Loader" },
    "@/components/Button": { Button: "Button" },
    "./wallet-ui": { Copy: "Copy", ui: { copy: {} } },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { FinancialReadState } = local(filename) as {
      FinancialReadState: (props: unknown) => unknown;
    };
    const child = { type: "Balance", props: { children: "private amount" } };
    const render = (status: string) =>
      elements(
        FinancialReadState({
          state: { status, data: status === "loading" ? undefined : {} },
          children: child,
        }),
      );
    assert.equal(
      render("loading").filter((node) => node.type === "Loader").length,
      1,
    );
    assert.ok(render("refreshing").includes(child));
    assert.equal(
      render("refreshing").filter((node) => node.type === "Loader").length,
      0,
    );
    assert.equal(render("denied").includes(child), false);
    assert.ok(render("refresh-error").includes(child));
    assert.equal(
      render("refresh-error").filter((node) => node.type === "Loader").length,
      0,
    );
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});
